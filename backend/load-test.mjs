/**
 * Expezplit Load Testing & Concurrency Benchmark
 *
 * Tests the system under varying concurrency levels:
 * - Health Check throughput (read baseline)
 * - Rate Limiter enforcement & sliding window capacity
 * - BullMQ Job Dispatch under high concurrency (write throughput)
 */

import http from "node:http";

const TARGET_URL = process.env.TEST_URL || "http://localhost:4000";
const CONCURRENCY = parseInt(process.env.CONCURRENCY, 10) || 50;
const DURATION_SECONDS = parseInt(process.env.DURATION, 10) || 10;

console.log("═══════════════════════════════════════════════════════════");
console.log("         EXPEZPLIT CONCURRENCY & LOAD BENCHMARK            ");
console.log("═══════════════════════════════════════════════════════════");
console.log(` Target URL:    ${TARGET_URL}`);
console.log(` Concurrency:   ${CONCURRENCY} concurrent connections`);
console.log(` Duration:      ${DURATION_SECONDS} seconds`);
console.log("───────────────────────────────────────────────────────────");

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 200,
});

async function runBenchmark(name, endpoint, method = "GET", body = null) {
  console.log(`\n▶ Running test: [${name}] ...`);

  let totalRequests = 0;
  let success200 = 0;
  let rateLimited429 = 0;
  let errors = 0;
  const latencies = [];

  const startTime = Date.now();
  const endTime = startTime + DURATION_SECONDS * 1000;

  async function worker(workerId) {
    while (Date.now() < endTime) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${TARGET_URL}${endpoint}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": `192.168.1.${workerId % 200}`, // Simulate unique client IPs
          },
          body: body ? JSON.stringify(body) : undefined,
        });

        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        totalRequests++;

        if (res.status === 200) {
          success200++;
        } else if (res.status === 429) {
          rateLimited429++;
        } else {
          errors++;
        }
      } catch (err) {
        errors++;
        totalRequests++;
      }
    }
  }

  // Launch workers
  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i + 1));
  await Promise.all(workers);

  const totalTimeSec = (Date.now() - startTime) / 1000;
  const rps = (totalRequests / totalTimeSec).toFixed(2);

  latencies.sort((a, b) => a - b);
  const p50 = (latencies[Math.floor(latencies.length * 0.5)] || 0).toFixed(2);
  const p95 = (latencies[Math.floor(latencies.length * 0.95)] || 0).toFixed(2);
  const p99 = (latencies[Math.floor(latencies.length * 0.99)] || 0).toFixed(2);
  const min = (latencies[0] || 0).toFixed(2);
  const max = (latencies[latencies.length - 1] || 0).toFixed(2);

  console.log("───────────────────────────────────────────────────────────");
  console.log(` Results for: ${name}`);
  console.log(`   Total Requests:      ${totalRequests.toLocaleString()}`);
  console.log(`   Throughput (RPS):    ${rps} req/sec`);
  console.log(`   Successful (200):    ${success200.toLocaleString()}`);
  console.log(`   Rate Limited (429):  ${rateLimited429.toLocaleString()}`);
  console.log(`   Errors (5xx/other):  ${errors.toLocaleString()}`);
  console.log(" Latency Breakdown:");
  console.log(`   Min:  ${min} ms | Max:  ${max} ms`);
  console.log(`   p50:  ${p50} ms (median)`);
  console.log(`   p95:  ${p95} ms (95% of users)`);
  console.log(`   p99:  ${p99} ms (worst 1%)`);
}

async function main() {
  // Test 1: API Health / Read throughput (Rate limited per simulated IP)
  await runBenchmark(
    "Read Throughput (/api/health)",
    "/api/health",
    "GET"
  );

  // Test 2: BullMQ Queue Dispatch (Write throughput)
  await runBenchmark(
    "BullMQ Write Dispatch (/api/send-email)",
    "/api/send-email",
    "POST",
    {
      participants: [{ name: "LoadTest", email: "bench@test.com", amount: 10 }],
      groupName: "Benchmark Group",
      payerName: "Runner",
      payerEmail: "runner@test.com",
      expenseDescription: "Load Test Expense",
    }
  );

  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Benchmark Complete! Check Grafana at http://localhost:3030");
  console.log("  and Bull Board at http://localhost:9100/admin/queues");
  console.log("═══════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
