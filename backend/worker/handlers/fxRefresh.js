/**
 * FX Rate Refresh Handler
 *
 * Periodically fetches exchange rates from an external API and
 * caches them in Redis. Replaces client-side polling with a
 * single server-side cron (BullMQ repeatable job, every 5 min).
 *
 * The cached rates can be served by the API gateway at GET /api/rates
 * without hitting the external API on every request.
 */

import { getRedisClient } from "../../shared/redis.js";
import { captureException } from "../../shared/sentry.js";

const FX_API_BASE = "https://v6.exchangerate-api.com/v6";
const CACHE_TTL_SECONDS = 300; // 5 minutes

/**
 * Process the FX refresh job.
 * Fetches latest rates and stores them in Redis.
 */
export async function refreshFxRates() {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  if (!apiKey) {
    console.log("[FX Refresh] No EXCHANGE_RATE_API_KEY set — skipping");
    return { skipped: true, reason: "No API key" };
  }

  try {
    const baseCurrency = process.env.FX_BASE_CURRENCY || "INR";
    const url = `${FX_API_BASE}/${apiKey}/latest/${baseCurrency}`;

    console.log(`[FX Refresh] Fetching rates for ${baseCurrency}...`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`FX API returned ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.result !== "success") {
      throw new Error(`FX API error: ${data["error-type"] || "unknown"}`);
    }

    // Cache the full rates object in Redis
    const redis = getRedisClient();
    await redis.setex(
      `fx:rates:${baseCurrency}`,
      CACHE_TTL_SECONDS,
      JSON.stringify({
        base: baseCurrency,
        rates: data.conversion_rates,
        lastUpdated: new Date().toISOString(),
        nextUpdate: data.time_next_update_utc,
      })
    );

    const rateCount = Object.keys(data.conversion_rates).length;
    console.log(`[FX Refresh] ✓ Cached ${rateCount} rates for ${baseCurrency} (TTL: ${CACHE_TTL_SECONDS}s)`);

    return { success: true, base: baseCurrency, rateCount };
  } catch (error) {
    console.error("[FX Refresh] Failed:", error.message);
    captureException(error, { context: "fx-refresh" });
    throw error; // Trigger BullMQ retry
  }
}
