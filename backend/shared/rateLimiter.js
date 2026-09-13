/**
 * Rate Limiter Middleware — Redis-backed sliding window
 *
 * Protects all API endpoints against abuse.
 * Default: 50 requests per 60 seconds per user (or IP for unauthenticated).
 * Matches the target from EXPEZPLIT_SCALING_ARCHITECTURE.md §5.
 */

import { RateLimiterRedis } from "rate-limiter-flexible";
import { getRedisClient } from "./redis.js";

let _limiter = null;

function getLimiter() {
  if (!_limiter) {
    _limiter = new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix: "rl",
      points: parseInt(process.env.RATE_LIMIT_POINTS, 10) || 50,
      duration: parseInt(process.env.RATE_LIMIT_DURATION, 10) || 60,
      blockDuration: 0, // Don't block after limit — just reject
    });
  }
  return _limiter;
}

/**
 * Express middleware — attach after auth so req.user is available.
 * Falls back to IP-based limiting for unauthenticated requests.
 */
export function rateLimiterMiddleware(req, res, next) {
  const key = req.user?.id || req.ip || "anonymous";

  getLimiter()
    .consume(key)
    .then((rateLimiterRes) => {
      // Attach rate-limit headers for transparency
      res.set("X-RateLimit-Limit", String(getLimiter()._points));
      res.set("X-RateLimit-Remaining", String(rateLimiterRes.remainingPoints));
      res.set(
        "X-RateLimit-Reset",
        String(new Date(Date.now() + rateLimiterRes.msBeforeNext).toISOString())
      );
      next();
    })
    .catch((rateLimiterRes) => {
      const retryAfter = Math.ceil(rateLimiterRes.msBeforeNext / 1000);
      res.set("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests, slow down.",
        retryAfterSeconds: retryAfter,
      });
    });
}
