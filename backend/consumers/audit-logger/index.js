/**
 * Kafka Consumer — Audit Logger (§8)
 *
 * Subscribes to ALL Expezplit event topics and writes a durable
 * audit log. Useful for compliance, debugging, and event replay.
 *
 * Topics consumed:
 *   - expense.created
 *   - expense.deleted
 *   - debt.settled
 *   - group.created
 *   - member.joined
 *
 * This is an OPTIONAL component — only deploy when Kafka is enabled.
 */

import "dotenv/config";
import { Kafka } from "kafkajs";
import { appendFile } from "node:fs/promises";
import { join } from "node:path";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");
const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR || "/var/log/expezplit";

const kafka = new Kafka({
  clientId: "audit-logger",
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "audit-logger" });

const TOPICS = [
  "expense.created",
  "expense.deleted",
  "debt.settled",
  "group.created",
  "member.joined",
];

async function writeAuditEntry(topic, partition, offset, payload) {
  const entry = {
    timestamp: new Date().toISOString(),
    topic,
    partition,
    offset: offset.toString(),
    payload,
  };

  // TODO: In production, write to a proper audit store (database, S3, etc.)
  // For now, append to a JSON-lines log file
  const logFile = join(AUDIT_LOG_DIR, `audit-${new Date().toISOString().split("T")[0]}.jsonl`);

  try {
    await appendFile(logFile, JSON.stringify(entry) + "\n");
  } catch {
    // Fallback to console if file write fails
    console.log("[audit-logger] ENTRY:", JSON.stringify(entry));
  }
}

async function start() {
  await consumer.connect();
  console.log("[audit-logger] Consumer connected");

  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: true });
  }

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const payload = JSON.parse(message.value.toString());
        await writeAuditEntry(topic, partition, message.offset, payload);
        console.log(`[audit-logger] Logged: ${topic} (offset ${message.offset})`);
      } catch (err) {
        console.error("[audit-logger] Error:", err);
      }
    },
  });
}

start().catch((err) => {
  console.error("[audit-logger] Failed to start:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
