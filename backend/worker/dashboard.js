/**
 * Bull Board Dashboard (§6.6)
 *
 * Web UI for monitoring BullMQ queues — shows waiting/active/completed/failed
 * jobs per queue, retry counts, and manual retry/inspect capabilities.
 *
 * This is the Node.js equivalent of Celery's Flower.
 * Accessible at: http://localhost:9100/admin/queues
 *
 * In production, protect this route behind admin authentication.
 */

import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue, csvExportQueue, fxRefreshQueue, notificationQueue } from "./queues/index.js";
import { metricsHandler } from "../shared/metrics.js";

const app = express();
const DASHBOARD_PORT = process.env.DASHBOARD_PORT || 9100;

// ── Bull Board Setup ────────────────────────────────────────────────
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(csvExportQueue),
    new BullMQAdapter(fxRefreshQueue),
    new BullMQAdapter(notificationQueue),
  ],
  serverAdapter,
});

// Mount the dashboard
app.use("/admin/queues", serverAdapter.getRouter());

// ── Health & Metrics ────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "worker-dashboard",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/metrics", metricsHandler);

// ── Start ───────────────────────────────────────────────────────────
app.listen(DASHBOARD_PORT, () => {
  console.log(`[Bull Board] Dashboard: http://localhost:${DASHBOARD_PORT}/admin/queues`);
  console.log(`[Bull Board] Metrics:   http://localhost:${DASHBOARD_PORT}/metrics`);
});
