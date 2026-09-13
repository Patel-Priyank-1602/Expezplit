/**
 * Expezplit Email Service — Backward-Compatible Bridge
 *
 * Accepts the same /api/send-email endpoint as the original emailServer.mjs
 * but enqueues to BullMQ instead of sending emails synchronously.
 *
 * This service exists for backward compatibility during migration:
 * - The frontend can keep calling the same URL
 * - Emails are now processed asynchronously with retries
 *
 * Once fully migrated to the API Gateway, this service can be retired.
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { Queue } from "bullmq";
import { getRedisConnectionOpts, closeRedisConnections } from "../shared/redis.js";
import { metricsMiddleware, metricsHandler } from "../shared/metrics.js";
import { initSentry, attachSentryErrorHandler, captureException } from "../shared/sentry.js";

const app = express();
const PORT = process.env.PORT || 3001; // Same port as original emailServer.mjs

// ── Sentry ──────────────────────────────────────────────────────────
initSentry({ serviceName: "email-service", app });

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);

// ── BullMQ Queue ────────────────────────────────────────────────────
const connection = getRedisConnectionOpts();
const emailQueue = new Queue("email-queue", { connection });

// ── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/send-email
 *
 * 100% backward-compatible with the original emailServer.mjs API.
 * Instead of synchronous SMTP, enqueues a BullMQ job.
 */
app.post("/api/send-email", async (req, res) => {
  try {
    const {
      participants,
      groupName,
      payerName,
      payerEmail,
      payerUpiId,
      expenseDescription,
    } = req.body;

    // Validate required fields (same validation as original)
    if (!participants || !groupName || !payerName || !payerEmail || !expenseDescription) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Filter out the payer from recipients (same logic as original)
    const recipients = participants.filter(
      (p) => p.email.toLowerCase() !== payerEmail.toLowerCase()
    );

    if (recipients.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No emails to send (payer is the only participant)",
        sent: 0,
      });
    }

    // Enqueue — the worker handles actual sending + retries
    const job = await emailQueue.add(
      "send-expense-email",
      {
        participants: recipients,
        groupName,
        payerName,
        payerEmail,
        payerUpiId,
        expenseDescription,
      },
      {
        attempts: 5,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 1000,
        removeOnFail: false,
      }
    );

    res.status(200).json({
      success: true,
      message: `Queued ${recipients.length} email(s) for delivery (job: ${job.id})`,
      sent: recipients.length, // For backward compat, report as "sent"
      queued: recipients.length,
      jobId: job.id,
    });
  } catch (error) {
    console.error("[Email Service] API error:", error);
    captureException(error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to queue emails",
    });
  }
});

// ── Health & Metrics ────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "email-service",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/metrics", metricsHandler);

// ── Error Handling ──────────────────────────────────────────────────
attachSentryErrorHandler(app);

app.use((err, req, res, _next) => {
  console.error("[Email Service] Unhandled error:", err);
  captureException(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[Email Service] Running on http://localhost:${PORT}`);
  console.log(`[Email Service] Health: http://localhost:${PORT}/api/health`);
  console.log(`[Email Service] Backward-compatible with original emailServer.mjs`);
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Email Service] SIGTERM received, shutting down...");
  await emailQueue.close();
  await closeRedisConnections();
  process.exit(0);
});
