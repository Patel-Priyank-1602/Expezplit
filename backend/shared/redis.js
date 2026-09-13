/**
 * Shared Redis client factory
 * Used by: api-gateway, sse-gateway, worker, email-service
 *
 * Creates lazily-initialized, reusable Redis connections.
 * Supports both a general-purpose client and a dedicated pub/sub subscriber.
 */

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

let _client = null;
let _subscriber = null;

/**
 * Returns a shared Redis client for commands (GET, SET, INCR, etc.)
 * and as the BullMQ connection backend.
 */
export function getRedisClient() {
  if (!_client) {
    const isTls = REDIS_URL.startsWith("rediss://");
    _client = new Redis(REDIS_URL, {
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        console.log(`[Redis] Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    _client.on("connect", () => console.log("[Redis] Client connected"));
    _client.on("error", (err) => console.error("[Redis] Client error:", err.message));
  }

  return _client;
}

/**
 * Returns a dedicated Redis client for pub/sub subscriptions.
 * Pub/sub clients cannot be used for regular commands once subscribed.
 */
export function getRedisSubscriber() {
  if (!_subscriber) {
    const isTls = REDIS_URL.startsWith("rediss://");
    _subscriber = new Redis(REDIS_URL, {
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy(times) {
        const delay = Math.min(times * 200, 5000);
        console.log(`[Redis-Sub] Reconnecting in ${delay}ms (attempt ${times})`);
        return delay;
      },
    });

    _subscriber.on("connect", () => console.log("[Redis-Sub] Subscriber connected"));
    _subscriber.on("error", (err) => console.error("[Redis-Sub] Subscriber error:", err.message));
  }

  return _subscriber;
}

/**
 * Returns the raw Redis connection options for BullMQ.
 * BullMQ manages its own connections internally.
 */
export function getRedisConnectionOpts() {
  const url = new URL(REDIS_URL);
  const isTls = url.protocol === "rediss:";
  return {
    host: url.hostname || "localhost",
    port: parseInt(url.port, 10) || 6379,
    username: url.username || undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    tls: isTls ? { rejectUnauthorized: false } : undefined,
    maxRetriesPerRequest: null,
  };
}

/**
 * Graceful shutdown — close all Redis connections.
 */
export async function closeRedisConnections() {
  const closes = [];
  if (_client) {
    closes.push(_client.quit().catch(() => _client.disconnect()));
    _client = null;
  }
  if (_subscriber) {
    closes.push(_subscriber.quit().catch(() => _subscriber.disconnect()));
    _subscriber = null;
  }
  await Promise.allSettled(closes);
  console.log("[Redis] All connections closed");
}
