/**
 * Kafka Consumer — Analytics Aggregator (§8)
 *
 * Reads `expense.created` events from Kafka and updates
 * spending aggregates (totals by category, group, time period).
 *
 * This is an OPTIONAL component — only deploy when Kafka is enabled.
 * Uses a separate consumer group so it reads the same events independently
 * from the notification-fanout consumer.
 */

import "dotenv/config";
import { Kafka } from "kafkajs";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "kafka:9092").split(",");

const kafka = new Kafka({
  clientId: "analytics-aggregator",
  brokers: KAFKA_BROKERS,
});

const consumer = kafka.consumer({ groupId: "analytics-aggregator" });

async function updateSpendingAggregates(expense) {
  // TODO: Implement aggregation logic
  // Options:
  // 1. Update a Redis sorted set for real-time leaderboards
  // 2. Upsert into a Supabase analytics table
  // 3. Write to a time-series database
  console.log("[analytics-aggregator] Processing:", {
    group: expense.groupName,
    amount: expense.amount,
    payer: expense.payerName,
  });
}

async function start() {
  await consumer.connect();
  console.log("[analytics-aggregator] Consumer connected");

  await consumer.subscribe({ topic: "expense.created", fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      try {
        const expense = JSON.parse(message.value.toString());
        await updateSpendingAggregates(expense);
      } catch (err) {
        console.error("[analytics-aggregator] Error:", err);
      }
    },
  });
}

start().catch((err) => {
  console.error("[analytics-aggregator] Failed to start:", err);
  process.exit(1);
});

process.on("SIGTERM", async () => {
  await consumer.disconnect();
  process.exit(0);
});
