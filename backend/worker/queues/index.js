/**
 * BullMQ Queue Definitions (§6.2)
 *
 * One queue per job type — each can be scaled, monitored,
 * and retried independently.
 */

import { Queue } from "bullmq";
import { getRedisConnectionOpts } from "../../shared/redis.js";

const connection = getRedisConnectionOpts();

export const emailQueue = new Queue("email-queue", { connection });
export const csvExportQueue = new Queue("csv-export-queue", { connection });
export const fxRefreshQueue = new Queue("fx-refresh-queue", { connection });
export const notificationQueue = new Queue("notification-queue", { connection });
