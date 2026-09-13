/**
 * Prometheus Metrics — shared instrumentation for all services
 *
 * Each service imports this module to get:
 * - Default Node.js metrics (event loop lag, memory, GC, etc.)
 * - HTTP request duration histogram
 * - A `/metrics` route handler for Prometheus scraping
 */

import client from "prom-client";

// Collect default Node.js metrics (CPU, memory, event loop, GC)
client.collectDefaultMetrics({
  prefix: "expezplit_",
});

/**
 * HTTP request duration histogram — track latency per method/route/status.
 * Buckets tuned for typical API response times (5ms → 10s).
 */
export const httpRequestDuration = new client.Histogram({
  name: "expezplit_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

/**
 * Active SSE connections gauge — used by the SSE gateway.
 */
export const sseActiveConnections = new client.Gauge({
  name: "expezplit_sse_active_connections",
  help: "Number of active SSE connections",
});

/**
 * Queue job counters — used by the worker service.
 */
export const queueJobsProcessed = new client.Counter({
  name: "expezplit_queue_jobs_processed_total",
  help: "Total number of queue jobs processed",
  labelNames: ["queue", "status"],
});

/**
 * Email delivery counter — track send success/failure.
 */
export const emailsSent = new client.Counter({
  name: "expezplit_emails_sent_total",
  help: "Total emails sent",
  labelNames: ["status"],
});

/**
 * Express middleware — records request duration automatically.
 */
export function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();

  res.on("finish", () => {
    // Normalize route to avoid high-cardinality labels
    const route = req.route?.path || req.path || "unknown";
    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });

  next();
}

/**
 * Express route handler — serves Prometheus metrics at GET /metrics.
 */
export async function metricsHandler(req, res) {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}

export { client as promClient };
