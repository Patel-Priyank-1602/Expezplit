/**
 * Sentry Error Tracking — shared initialization for all services
 *
 * Each service calls initSentry({ serviceName }) at startup.
 * Captures unhandled exceptions, promise rejections, and express errors.
 *
 * Requires SENTRY_DSN environment variable. If not set, Sentry
 * initializes in disabled mode (no-op) so services still work.
 */

import * as Sentry from "@sentry/node";

/**
 * Initialize Sentry for a service.
 * @param {Object} opts
 * @param {string} opts.serviceName — e.g. "api-gateway", "worker", "sse-gateway"
 * @param {Express} [opts.app] — Express app instance for request/error handlers
 */
export function initSentry({ serviceName, app }) {
  if (!process.env.SENTRY_DSN) {
    console.log(`[Sentry] No SENTRY_DSN set — error tracking disabled for ${serviceName}`);
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || "development",
    serverName: serviceName,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.2,
    // Tag every event with the service name for filtering
    initialScope: {
      tags: { service: serviceName },
    },
  });

  // Attach Express request handler (must be first middleware)
  if (app) {
    app.use(Sentry.Handlers.requestHandler());
  }

  console.log(`[Sentry] Initialized for ${serviceName}`);
}

/**
 * Attach Sentry error handler to Express (must be after all routes).
 * @param {Express} app
 */
export function attachSentryErrorHandler(app) {
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }
}

/**
 * Manually capture an exception (for use in workers, consumers, etc.)
 */
export function captureException(err, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(err, { extra: context });
  }
}

export { Sentry };
