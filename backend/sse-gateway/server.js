/**
 * Expezplit SSE Gateway
 *
 * Dedicated server for Server-Sent Events (SSE) — pushes real-time
 * notifications to connected clients via Redis pub/sub.
 *
 * Architecture (§7):
 * - Worker or Kafka consumer publishes to Redis channel `notifications:{email}`
 * - This gateway subscribes to the channel and streams events to the client
 * - Auto-reconnect is handled by the browser's native EventSource API
 *
 * Why SSE over WebSockets: notifications are server→client only,
 * SSE auto-reconnects natively, and plays nicer with HTTP/2 LBs and K8s ingress.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import Redis from "ioredis";
import { sseActiveConnections, metricsMiddleware, metricsHandler } from "../shared/metrics.js";
import { initSentry, attachSentryErrorHandler, captureException } from "../shared/sentry.js";

const app = express();
const PORT = process.env.SSE_PORT || 4001;
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// ── Sentry ──────────────────────────────────────────────────────────
initSentry({ serviceName: "sse-gateway", app });

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(metricsMiddleware);

// ── Track active connections per user for debugging ─────────────────
const activeConnections = new Map(); // email → Set<res>

/**
 * GET /events/:userEmail
 *
 * Opens a long-lived SSE stream. The client connects with:
 *   const es = new EventSource(`/events/${encodeURIComponent(email)}`);
 *   es.onmessage = (e) => handleNotification(JSON.parse(e.data));
 */
app.get("/events/:userEmail", (req, res) => {
  const userEmail = decodeURIComponent(req.params.userEmail).toLowerCase();
  const channel = `notifications:${userEmail}`;

  // SSE headers
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no", // Disable nginx buffering for SSE
  });
  res.flushHeaders();

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", channel })}\n\n`);

  // Track this connection
  if (!activeConnections.has(userEmail)) {
    activeConnections.set(userEmail, new Set());
  }
  activeConnections.get(userEmail).add(res);
  sseActiveConnections.inc();

  console.log(`[SSE] Client connected: ${userEmail} (total: ${sseActiveConnections._getValue?.() || "?"})`);

  // Create a dedicated Redis subscriber for this connection
  const sub = new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      return Math.min(times * 200, 5000);
    },
  });

  sub.subscribe(channel, (err) => {
    if (err) {
      console.error(`[SSE] Failed to subscribe to ${channel}:`, err.message);
      captureException(err, { channel, userEmail });
    }
  });

  sub.on("message", (chan, message) => {
    if (chan === channel) {
      res.write(`data: ${message}\n\n`);
    }
  });

  // Heartbeat every 30s to keep the connection alive through proxies
  const heartbeat = setInterval(() => {
    res.write(`:heartbeat ${Date.now()}\n\n`);
  }, 30_000);

  // Clean up on client disconnect
  req.on("close", () => {
    clearInterval(heartbeat);
    sub.unsubscribe(channel);
    sub.disconnect();

    const conns = activeConnections.get(userEmail);
    if (conns) {
      conns.delete(res);
      if (conns.size === 0) activeConnections.delete(userEmail);
    }
    sseActiveConnections.dec();

    console.log(`[SSE] Client disconnected: ${userEmail}`);
  });
});

/**
 * GET /events/status
 *
 * Returns the number of active connections (for monitoring).
 */
app.get("/events/status", (req, res) => {
  const connections = {};
  for (const [email, conns] of activeConnections) {
    connections[email] = conns.size;
  }
  res.json({
    totalConnections: Array.from(activeConnections.values()).reduce((sum, s) => sum + s.size, 0),
    connections,
  });
});

// ── Health & Metrics ────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "sse-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    activeConnections: Array.from(activeConnections.values()).reduce((sum, s) => sum + s.size, 0),
  });
});

app.get("/metrics", metricsHandler);

// ── Error handling ──────────────────────────────────────────────────
attachSentryErrorHandler(app);

app.use((err, req, res, _next) => {
  console.error("[SSE Gateway] Unhandled error:", err);
  captureException(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[SSE Gateway] Running on http://localhost:${PORT}`);
  console.log(`[SSE Gateway] Connect: http://localhost:${PORT}/events/{email}`);
  console.log(`[SSE Gateway] Health: http://localhost:${PORT}/api/health`);
  console.log(`[SSE Gateway] Metrics: http://localhost:${PORT}/metrics`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("[SSE Gateway] SIGTERM received, closing connections...");
  for (const [, conns] of activeConnections) {
    for (const res of conns) {
      res.end();
    }
  }
  process.exit(0);
});
