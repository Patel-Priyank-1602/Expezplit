/**
 * BullMQ Scheduled/Recurring Jobs (§6.4)
 *
 * Replaces Celery Beat — BullMQ's repeatable jobs handle
 * cron-style scheduling natively.
 *
 * Currently configured:
 * - FX rate refresh every 5 minutes
 */

import { fxRefreshQueue } from "./queues/index.js";

console.log("[Schedule] Setting up recurring jobs...");

// FX Rate refresh — every 5 minutes
await fxRefreshQueue.add(
  "refresh-rates",
  {},
  {
    repeat: { every: 300_000 }, // 5 minutes (matches RATE_REFRESH_MS)
    jobId: "fx-refresh-recurring", // Prevents duplicate schedules on restart
  }
);

console.log("[Schedule] ✓ FX rate refresh: every 5 minutes");
console.log("[Schedule] All recurring jobs configured");
