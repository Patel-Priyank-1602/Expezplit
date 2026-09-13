/**
 * Kafka Consumer — Notification Fan-out (§8)
 *
 * Reads `expense.created` events from Kafka and publishes
 * notifications to Redis pub/sub for SSE delivery.
 *
 * This is an OPTIONAL component — only deploy when Kafka is enabled
 * and you need durable, replayable event streaming.
 *
 * At 50 users/min, the BullMQ notification-queue is sufficient.
 */

import "dotenv/config";
import { Kafka } from "kafkajs";
import Redis from "ioredis";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

const kafka = new Kafka({
  clientId: "notification-fanout",
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "notification-fanout" });
const redis = new Redis(REDIS_URL);

async function start() {
  await consumer.connect();
  console.log("[notification-fanout] Consumer connected");

  await consumer.subscribe({ topic: "expense.created", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const expense = JSON.parse(message.value.toString());
        console.log(`[notification-fanout] Processing: ${topic} (partition ${partition})`);

        // Publish to the payer's SSE channel
        if (expense.payerEmail) {
          await redis.publish(
            `notifications:${expense.payerEmail.toLowerCase()}`,
            JSON.stringify({
              type: "expense.created",
              ...expense,
              timestamp: new Date().toISOString(),
            })
          );
        }

        // Publish to each participant's SSE channel
        if (expense.participants) {
          for (const p of expense.participants) {
            if (p.email && p.email.toLowerCase() !== expense.payerEmail?.toLowerCase()) {
              await redis.publish(
                `notifications:${p.email.toLowerCase()}`,
                JSON.stringify({
                  type: "expense.created",
                  ...expense,
                  timestamp: new Date().toISOString(),
                })
              );
            }
          }
        }
      } catch (err) {
        console.error("[notification-fanout] Error processing message:", err);
      }
    },
  });
}

start().catch((err) => {
  console.error("[notification-fanout] Failed to start:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  redis.disconnect();
  process.exit(0);
});
