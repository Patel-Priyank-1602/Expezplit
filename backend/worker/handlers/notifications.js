/**
 * Notification Fan-out Handler
 *
 * When an expense is created (or debt settled), this handler publishes
 * a notification to each affected user's Redis pub/sub channel.
 * The SSE Gateway picks up these messages and streams them to
 * connected browser clients.
 *
 * Flow: API Gateway → BullMQ (notification-queue) → this handler → Redis pub/sub → SSE Gateway → Browser
 */

import { getRedisClient } from "../../shared/redis.js";
import { captureException } from "../../shared/sentry.js";

/**
 * Process a notification fan-out job.
 *
 * Job data shape:
 * {
 *   type: "expense.created" | "expense.deleted" | "debt.settled" | ...,
 *   groupName?: string,
 *   payerName?: string,
 *   payerEmail?: string,
 *   expenseDescription?: string,
 *   recipients?: string[],       // list of email addresses to notify
 *   expenseId?: string,
 *   ... any additional payload
 * }
 */
export async function fanOutNotification(data) {
  const { type, recipients, payerEmail, ...payload } = data;

  if (!recipients || recipients.length === 0) {
    console.log("[Notification] No recipients — skipping fan-out");
    return { sent: 0 };
  }

  const redis = getRedisClient();
  let sent = 0;

  for (const email of recipients) {
    const channel = `notifications:${email.toLowerCase()}`;
    const message = JSON.stringify({
      type,
      from: payerEmail,
      timestamp: new Date().toISOString(),
      ...payload,
    });

    try {
      await redis.publish(channel, message);
      sent++;
    } catch (error) {
      console.error(`[Notification] Failed to publish to ${channel}:`, error.message);
      captureException(error, { channel, type });
    }
  }

  console.log(`[Notification] Fan-out complete: ${sent}/${recipients.length} published (type: ${type})`);
  return { sent, total: recipients.length };
}
