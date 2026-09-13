/**
 * Expezplit API Gateway
 *
 * Central entry point for all client requests. Replaces the monolithic
 * emailServer.mjs with a scalable, observable gateway that:
 *
 * 1. Rate-limits requests via Redis (§5)
 * 2. Produces BullMQ jobs instead of synchronous SMTP calls (§6)
 * 3. Publishes Kafka events for downstream consumers (§8, optional)
 * 4. Exposes Prometheus metrics at /metrics (§9)
 * 5. Tracks errors via Sentry (§9.3)
 * 6. Provides health checks for Kubernetes liveness/readiness probes
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { Queue } from "bullmq";
import { getRedisConnectionOpts, getRedisClient, closeRedisConnections } from "../shared/redis.js";
import { rateLimiterMiddleware } from "../shared/rateLimiter.js";
import { metricsMiddleware, metricsHandler } from "../shared/metrics.js";
import { initSentry, attachSentryErrorHandler, captureException } from "../shared/sentry.js";

const app = express();
const PORT = process.env.PORT || 4000;

// ── Sentry (must be first) ──────────────────────────────────────────
initSentry({ serviceName: "api-gateway", app });

// ── Middleware ───────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(metricsMiddleware);
app.use(rateLimiterMiddleware);

// ── BullMQ Queues ───────────────────────────────────────────────────
const connection = getRedisConnectionOpts();
const emailQueue = new Queue("email-queue", { connection });
const csvExportQueue = new Queue("csv-export-queue", { connection });
const notificationQueue = new Queue("notification-queue", { connection });

// ── Kafka Producer (optional — only if KAFKA_BROKERS is set) ────────
let kafkaProducer = null;

async function initKafka() {
  if (!process.env.KAFKA_BROKERS) {
    console.log("[Kafka] KAFKA_BROKERS not set — Kafka disabled");
    return;
  }

  try {
    const { Kafka } = await import("kafkajs");
    const kafka = new Kafka({
      clientId: "api-gateway",
      brokers: process.env.KAFKA_BROKERS.split(","),
    });
    kafkaProducer = kafka.producer();
    await kafkaProducer.connect();
    console.log("[Kafka] Producer connected");
  } catch (err) {
    console.error("[Kafka] Failed to connect producer:", err.message);
  }
}

/**
 * Publish a Kafka event (no-op if Kafka is disabled).
 */
async function publishEvent(topic, key, payload) {
  if (!kafkaProducer) return;
  try {
    await kafkaProducer.send({
      topic,
      messages: [{ key, value: JSON.stringify(payload) }],
    });
  } catch (err) {
    console.error(`[Kafka] Failed to publish to ${topic}:`, err.message);
    captureException(err, { topic, key });
  }
}

// ── Routes ──────────────────────────────────────────────────────────

/**
 * POST /api/send-email
 *
 * Backward-compatible with the original emailServer.mjs API.
 * Instead of sending emails synchronously, enqueues a BullMQ job
 * with exponential backoff retries (5 attempts).
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

    // Validate required fields
    if (!participants || !groupName || !payerName || !payerEmail || !expenseDescription) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
      });
    }

    // Filter out the payer from recipients
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

    // Enqueue email job — fire-and-forget, worker handles retries
    await emailQueue.add(
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
        removeOnFail: false, // Keep failed jobs for inspection in Bull Board
      }
    );

    // Enqueue notification fan-out
    await notificationQueue.add("fan-out-notification", {
      type: "expense.created",
      groupName,
      payerName,
      payerEmail,
      expenseDescription,
      recipients: recipients.map((r) => r.email),
    });

    // Publish Kafka event (optional)
    await publishEvent("expense.created", groupName, {
      groupName,
      payerName,
      payerEmail,
      expenseDescription,
      participants: recipients,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      message: `Queued ${recipients.length} email(s) for delivery`,
      queued: recipients.length,
    });
  } catch (error) {
    console.error("Email API error:", error);
    captureException(error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to queue emails",
    });
  }
});

/**
 * POST /api/group-expenses
 *
 * Generic endpoint for creating group expenses with async processing.
 * The frontend can optionally call this instead of doing Supabase inserts
 * directly — useful when you want server-side validation + event publishing.
 */
app.post("/api/group-expenses", async (req, res) => {
  try {
    const expense = req.body;

    // Enqueue email notifications
    if (expense.participants?.length > 0) {
      await emailQueue.add(
        "send-expense-email",
        {
          participants: expense.participants,
          groupName: expense.groupName,
          payerName: expense.payerName,
          payerEmail: expense.payerEmail,
          payerUpiId: expense.payerUpiId,
          expenseDescription: expense.description,
        },
        {
          attempts: 5,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: 1000,
          removeOnFail: false,
        }
      );
    }

    // Enqueue notification fan-out
    await notificationQueue.add("fan-out-notification", {
      type: "expense.created",
      expenseId: expense.id,
      groupName: expense.groupName,
      payerName: expense.payerName,
      payerEmail: expense.payerEmail,
    });

    // Publish Kafka event
    await publishEvent("expense.created", expense.groupName || "default", expense);

    res.json({ success: true, expense });
  } catch (error) {
    console.error("Group expense error:", error);
    captureException(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/export-csv
 *
 * Enqueues a CSV export job. The worker generates the CSV and can
 * upload it to object storage or return via a download URL.
 */
app.post("/api/export-csv", async (req, res) => {
  try {
    const job = await csvExportQueue.add("generate-csv", req.body, {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
      removeOnComplete: 100,
    });

    res.json({
      success: true,
      jobId: job.id,
      message: "CSV export queued",
    });
  } catch (error) {
    console.error("CSV export error:", error);
    captureException(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Health & Metrics ────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get("/metrics", metricsHandler);

// ── Sentry error handler (must be after routes) ────────────────────
attachSentryErrorHandler(app);

// ── Global error handler ────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error("Unhandled error:", err);
  captureException(err);
  res.status(500).json({ error: "Internal server error" });
});

// ── Start ───────────────────────────────────────────────────────────
async function start() {
  await initKafka();

  // Embedded worker for single-service free-tier deployments (e.g. Render Free Tier)
  if (process.env.EMBEDDED_WORKER === "true") {
    console.log("[API Gateway] Starting embedded BullMQ workers & scheduler...");
    import("../worker/index.js").catch((err) =>
      console.error("[API Gateway] Failed to start embedded worker:", err.message)
    );
  }

  app.listen(PORT, () => {
    console.log(`[API Gateway] Running on http://localhost:${PORT}`);
    console.log(`[API Gateway] Health: http://localhost:${PORT}/api/health`);
    console.log(`[API Gateway] Metrics: http://localhost:${PORT}/metrics`);
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[API Gateway] SIGTERM received, shutting down...");
  if (kafkaProducer) await kafkaProducer.disconnect();
  await emailQueue.close();
  await csvExportQueue.close();
  await notificationQueue.close();
  await closeRedisConnections();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[API Gateway] SIGINT received, shutting down...");
  if (kafkaProducer) await kafkaProducer.disconnect();
  await emailQueue.close();
  await csvExportQueue.close();
  await notificationQueue.close();
  await closeRedisConnections();
  process.exit(0);
});

start();
