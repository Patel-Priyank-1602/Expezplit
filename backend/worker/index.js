/**
 * BullMQ Worker Entrypoint (§6.5)
 *
 * Registers all workers for each queue. Each worker runs in its own
 * container and can be scaled independently via Kubernetes/KEDA.
 *
 * Concurrency settings per queue type:
 * - email-queue: 5 concurrent (SMTP is I/O-bound, not CPU-bound)
 * - csv-export-queue: 3 concurrent (moderate CPU for large datasets)
 * - fx-refresh-queue: 1 concurrent (only one refresh at a time)
 * - notification-queue: 10 concurrent (Redis pub/sub is very fast)
 */

import "dotenv/config";
import { Worker } from "bullmq";
import { getRedisConnectionOpts } from "../shared/redis.js";
import { queueJobsProcessed } from "../shared/metrics.js";
import { initSentry, captureException } from "../shared/sentry.js";

import { sendExpenseEmail } from "./handlers/email.js";
import { generateAndUploadCsv } from "./handlers/csvExport.js";
import { refreshFxRates } from "./handlers/fxRefresh.js";
import { fanOutNotification } from "./handlers/notifications.js";

// ── Initialize ──────────────────────────────────────────────────────
initSentry({ serviceName: "worker" });

const connection = getRedisConnectionOpts();

console.log("[Worker] Starting BullMQ workers...");

/**
 * Helper — wraps a handler with metrics + error logging.
 */
function createWorker(queueName, handler, concurrency) {
  const worker = new Worker(
    queueName,
    async (job) => {
      console.log(`[${queueName}] Processing job ${job.id} (attempt ${job.attemptsMade + 1}/${job.opts.attempts || "∞"})`);
      try {
        const result = await handler(job.data);
        queueJobsProcessed.inc({ queue: queueName, status: "completed" });
        return result;
      } catch (error) {
        queueJobsProcessed.inc({ queue: queueName, status: "failed" });
        captureException(error, { queue: queueName, jobId: job.id, attempt: job.attemptsMade + 1 });
        throw error; // Re-throw so BullMQ retries
      }
    },
    { connection, concurrency }
  );

  worker.on("completed", (job) => {
    console.log(`[${queueName}] ✓ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${queueName}] ✗ Job ${job?.id} failed: ${err.message}`);
  });

  worker.on("error", (err) => {
    console.error(`[${queueName}] Worker error:`, err.message);
    captureException(err, { queue: queueName });
  });

  console.log(`[Worker] Registered: ${queueName} (concurrency: ${concurrency})`);
  return worker;
}

// ── Register Workers ────────────────────────────────────────────────
const workers = [
  createWorker("email-queue", sendExpenseEmail, 5),
  createWorker("csv-export-queue", generateAndUploadCsv, 3),
  createWorker("fx-refresh-queue", refreshFxRates, 1),
  createWorker("notification-queue", fanOutNotification, 10),
];

console.log(`[Worker] All ${workers.length} workers registered and listening`);

// ── Run scheduled jobs ──────────────────────────────────────────────
import("./schedule.js").catch((err) =>
  console.error("[Worker] Failed to load scheduled jobs:", err.message)
);

// ── Start Bull Board dashboard ──────────────────────────────────────
import("./dashboard.js").catch((err) =>
  console.error("[Worker] Failed to start dashboard:", err.message)
);

// ── Graceful Shutdown ───────────────────────────────────────────────
async function shutdown(signal) {
  console.log(`[Worker] ${signal} received, closing workers...`);
  await Promise.allSettled(workers.map((w) => w.close()));
  console.log("[Worker] All workers closed");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
