# Expezplit — Enterprise Scaling & Concurrency Architecture
### Version 4.0.0 — Multi-User Concurrent, Container-Native, Observable Infrastructure

---

## 0. Reality Check Before You Build This

Your target — **~50 concurrent users / minute (≈3,000 req/hour)** — is genuinely low
load. A single 2‑vCPU / 4GB VM running your current Node + React stack could handle
this without any of the tooling below. So why build it anyway?

- You're clearly planning for **future growth**, not just today's number.
- You want **resilience** (one bad deploy shouldn't take the whole app down).
- You want **visibility** (know about failures before users report them).
- It's a great **portfolio/learning exercise** in production-grade infra.

All valid reasons. Below is the real enterprise-grade path — entirely on
Node.js, with **no Python anywhere in the stack**. Celery is a Python-only
framework, so it's replaced throughout with **BullMQ**, its direct Redis-backed
equivalent for Node (see §6).

---

## 1. Target Non-Functional Requirements

| Requirement | Current State | Target State |
|---|---|---|
| Concurrent users | Single Node process, no queueing | Horizontally scaled, load-balanced |
| Email dispatch | Synchronous-ish, blocks on SMTP | Fully async, queued, retryable |
| Real-time notifications | Supabase Realtime only | SSE gateway + Kafka event backbone |
| Session/rate data | None (stateless) | Redis-backed |
| Deployment | Manual `npm run dev` / static hosts | Docker + Kubernetes, rolling deploys |
| Observability | None | Prometheus + Grafana dashboards, Sentry error tracking |
| Failure isolation | Single point of failure (email server) | Independent, restartable microservices |
| Autoscaling | None | Kubernetes HPA (CPU/queue-depth based) |

---

## 2. Updated High-Level Architecture

```
                                   ┌─────────────────────────┐
                                   │     Ingress / NGINX      │
                                   │  (TLS termination, LB)   │
                                   └────────────┬─────────────┘
                                                │
                    ┌───────────────────────────┼───────────────────────────┐
                    │                            │                            │
           ┌────────▼────────┐          ┌────────▼────────┐         ┌────────▼────────┐
           │ Frontend Pods    │          │  API Gateway Pods │         │  SSE Gateway Pods │
           │ (React static,   │          │  (Node/Express,   │         │ (Node, long-lived  │
           │  served via Nginx│          │   REST + auth)     │         │  /events stream)   │
           └──────────────────┘          └────────┬───────────┘         └────────┬───────────┘
                                                    │                              │
                     ┌──────────────────────────────┼──────────────────────────────┤
                     │                               │                              │
             ┌───────▼───────┐              ┌────────▼────────┐           ┌────────▼────────┐
             │  Redis Cluster │              │  Kafka Cluster    │           │  Supabase        │
             │ (cache, rate-  │◄────────────►│ (event backbone:   │──────────►│  PostgreSQL      │
             │  limit, pub/sub│              │  expense.created,  │           │  (RLS, source of │
             │  session store)│              │  debt.settled, ...)│           │   truth)         │
             └───────┬────────┘              └────────┬───────────┘           └──────────────────┘
                     │                                 │
          ┌──────────▼──────────┐          ┌───────────▼────────────┐
          │  Task Queue Workers  │          │ Kafka Consumers          │
          │  (BullMQ, Node)       │          │ - notification-fanout    │
          │  - email sending     │          │ - analytics-aggregator   │
          │  - CSV export        │          │ - audit-logger           │
          │  - FX rate refresh   │          └──────────────────────────┘
          └──────────┬───────────┘
                     │
             ┌────────▼────────┐
             │  Nodemailer/SMTP │
             └──────────────────┘

   Cross-cutting:  Prometheus (metrics) → Grafana (dashboards)
                   Sentry (error/exception tracking, all services)
                   All services containerized via Docker, orchestrated via Kubernetes
```

---

## 3. Docker — Containerize Every Service

Split the monolith into independently deployable images: `frontend`, `api-gateway`,
`sse-gateway`, `worker`, `email-service`.

### 3.1 `frontend/Dockerfile` (multi-stage build)
```dockerfile
# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- Serve stage ---
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### 3.2 `backend/api-gateway/Dockerfile`
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "server.js"]
```

### 3.3 `docker-compose.yml` (local dev parity with prod topology)
```yaml
version: "3.9"
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  kafka:
    image: bitnami/kafka:3.7
    environment:
      - KAFKA_CFG_NODE_ID=0
      - KAFKA_CFG_PROCESS_ROLES=controller,broker
      - KAFKA_CFG_LISTENERS=PLAINTEXT://:9092,CONTROLLER://:9093
      - KAFKA_CFG_CONTROLLER_QUORUM_VOTERS=0@kafka:9093
    ports: ["9092:9092"]

  api-gateway:
    build: ./backend/api-gateway
    depends_on: [redis, kafka]
    env_file: .env
    ports: ["4000:4000"]

  sse-gateway:
    build: ./backend/sse-gateway
    depends_on: [redis]
    ports: ["4001:4001"]

  worker:
    build: ./backend/worker
    depends_on: [redis, kafka]
    deploy:
      replicas: 2

  email-service:
    build: ./backend/email-service
    env_file: .env
    depends_on: [redis]

  frontend:
    build: ./frontend
    ports: ["8080:80"]

  prometheus:
    image: prom/prometheus
    volumes: ["./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml"]
    ports: ["9090:9090"]

  grafana:
    image: grafana/grafana
    ports: ["3000:3000"]
    depends_on: [prometheus]
```

---

## 4. Kubernetes — Orchestration & Autoscaling

Deploy each Docker image as its own Deployment + Service. Key manifests below
(trim namespaces/secrets as needed — use `kubectl create secret` or a secrets
manager, never commit `.env` to the cluster config).

### 4.1 API Gateway Deployment + HPA
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels: { app: api-gateway }
  template:
    metadata:
      labels: { app: api-gateway }
    spec:
      containers:
        - name: api-gateway
          image: your-registry/expezplit-api-gateway:latest
          ports: [{ containerPort: 4000 }]
          resources:
            requests: { cpu: "150m", memory: "192Mi" }
            limits: { cpu: "500m", memory: "512Mi" }
          envFrom:
            - secretRef: { name: expezplit-secrets }
          livenessProbe:
            httpGet: { path: /api/health, port: 4000 }
            initialDelaySeconds: 5
---
apiVersion: v1
kind: Service
metadata: { name: api-gateway }
spec:
  selector: { app: api-gateway }
  ports: [{ port: 80, targetPort: 4000 }]
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: api-gateway-hpa }
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target: { type: Utilization, averageUtilization: 65 }
```

### 4.2 Worker Deployment — scale on **queue depth**, not just CPU
Workers should scale based on how many jobs are waiting, since email/CSV jobs are
bursty rather than CPU-bound. Use **KEDA** (Kubernetes Event-Driven Autoscaling)
with a Redis or Kafka scaler:

```yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata: { name: worker-scaledobject }
spec:
  scaleTargetRef:
    name: worker
  minReplicaCount: 1
  maxReplicaCount: 8
  triggers:
    - type: redis
      metadata:
        address: redis:6379
        listName: bull:email-queue:wait
        listLength: "10"   # add a pod for every 10 queued jobs
```

### 4.3 SSE Gateway — needs sticky sessions
SSE connections are long-lived, so the Ingress must route a client back to the
same pod for the life of the connection:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: sse-ingress
  annotations:
    nginx.ingress.kubernetes.io/affinity: "cookie"
    nginx.ingress.kubernetes.io/affinity-mode: "persistent"
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
spec:
  rules:
    - host: events.expezplit.app
      http:
        paths:
          - path: /events
            pathType: Prefix
            backend:
              service: { name: sse-gateway, port: { number: 4001 } }
```

### 4.4 Namespace layout
```
expezplit-prod/
  ├── frontend
  ├── api-gateway
  ├── sse-gateway
  ├── worker
  ├── email-service
  ├── redis (or use managed Redis — see §9)
  ├── kafka (or use managed Kafka — see §9)
  └── monitoring (prometheus, grafana, alertmanager)
```

---

## 5. Redis — Cache, Rate Limiting, Pub/Sub, Session Store

Redis becomes the shared nervous system between your stateless pods.

| Use Case | Pattern |
|---|---|
| **Rate limiting** (protect against abuse, enforce your 50/min-style budgets) | Sliding window counter: `INCR user:{id}:window` + `EXPIRE`, or use `rate-limiter-flexible` npm package with a Redis store |
| **API response caching** | Cache FX rates (`GET /rates`), group balance summaries — TTL 5 min to match your existing polling interval |
| **Session/JWT blacklist** | Store revoked Clerk session IDs with TTL = token expiry |
| **Pub/Sub for SSE fan-out** | When a worker finishes a job or a DB row changes, `PUBLISH notifications:{userEmail}` — all SSE gateway pods subscribed relay to connected clients |
| **BullMQ queue backend** | BullMQ (Node's Celery-equivalent) uses Redis natively for job storage, retries, and delayed jobs |

Example rate limiter middleware:
```javascript
import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";

const redisClient = new Redis(process.env.REDIS_URL);
const limiter = new RateLimiterRedis({
  storeClient: redisClient,
  points: 50,        // 50 requests
  duration: 60,       // per 60 seconds — matches your stated target
});

app.use(async (req, res, next) => {
  try {
    await limiter.consume(req.user?.id || req.ip);
    next();
  } catch {
    res.status(429).json({ error: "Too many requests, slow down." });
  }
});
```

Use **Redis Sentinel** or a managed Redis (ElastiCache, Upstash, Redis Cloud) in
production for HA — a single Redis pod is a single point of failure.

---

## 6. Async Task Queue — BullMQ (Node-native, zero Python)

Celery is Python-only, so it's excluded entirely — everything below runs on
the same Node.js runtime as the rest of your stack. **BullMQ** is Redis-backed,
first-class TypeScript support, and gives you the same core capabilities
(retries, backoff, delayed/scheduled jobs, concurrency control) without a
second language, a second package ecosystem, or a second thing to deploy.

### 6.1 Install
```bash
npm install bullmq ioredis
```

### 6.2 Queue definitions — `backend/worker/queues/index.js`
Define one queue per job type so each can be scaled, monitored, and retried
independently.
```javascript
import { Queue } from "bullmq";

const connection = { host: process.env.REDIS_HOST || "redis", port: 6379 };

export const emailQueue = new Queue("email-queue", { connection });
export const csvExportQueue = new Queue("csv-export-queue", { connection });
export const fxRefreshQueue = new Queue("fx-refresh-queue", { connection });
export const notificationQueue = new Queue("notification-queue", { connection });
```

### 6.3 Producers — add jobs from the API gateway
```javascript
// api-gateway/routes/expenses.js — when an expense is added
import { emailQueue, notificationQueue } from "../../worker/queues/index.js";

app.post("/api/group-expenses", async (req, res) => {
  const expense = await createGroupExpense(req.body); // existing Supabase insert logic

  // fire-and-forget async jobs instead of blocking the response
  await emailQueue.add("send-expense-email", {
    participants: expense.participants,
    groupName: expense.groupName,
    payerName: expense.payerName,
    payerEmail: expense.payerEmail,
    expenseDescription: expense.description,
  }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 2000 },
    removeOnComplete: 1000,
    removeOnFail: false, // keep failed jobs for inspection in Bull Board
  });

  await notificationQueue.add("fan-out-notification", { expenseId: expense.id });

  res.json({ success: true, expense });
});
```

### 6.4 Scheduled/recurring jobs — replaces `celery beat`
BullMQ's repeatable jobs cover cron-style scheduling natively, e.g. your
5-minute FX rate refresh:
```javascript
// worker/schedule.js — run once at startup
import { fxRefreshQueue } from "./queues/index.js";

await fxRefreshQueue.add("refresh-rates", {}, {
  repeat: { every: 300_000 }, // 5 minutes, matches RATE_REFRESH_MS
  jobId: "fx-refresh-recurring", // prevents duplicate schedules on restart
});
```

### 6.5 Workers — `backend/worker/index.js` (its own Deployment/container)
```javascript
import { Worker } from "bullmq";
import { sendExpenseEmail } from "./handlers/email.js";
import { generateAndUploadCsv } from "./handlers/csvExport.js";
import { refreshFxRates } from "./handlers/fxRefresh.js";
import { fanOutNotification } from "./handlers/notifications.js";

const connection = { host: process.env.REDIS_HOST || "redis", port: 6379 };

new Worker("email-queue", async (job) => sendExpenseEmail(job.data),
  { connection, concurrency: 5 });

new Worker("csv-export-queue", async (job) => generateAndUploadCsv(job.data),
  { connection, concurrency: 3 });

new Worker("fx-refresh-queue", async () => refreshFxRates(),
  { connection, concurrency: 1 });

new Worker("notification-queue", async (job) => fanOutNotification(job.data),
  { connection, concurrency: 10 });
```

### 6.6 Bull Board — the monitoring dashboard (Celery's Flower, for BullMQ)
```bash
npm install @bull-board/express @bull-board/api
```
```javascript
// worker/dashboard.js — mount on an internal-only route, behind auth
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter.js";
import { ExpressAdapter } from "@bull-board/express";
import { emailQueue, csvExportQueue, fxRefreshQueue, notificationQueue } from "./queues/index.js";

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [
    new BullMQAdapter(emailQueue),
    new BullMQAdapter(csvExportQueue),
    new BullMQAdapter(fxRefreshQueue),
    new BullMQAdapter(notificationQueue),
  ],
  serverAdapter,
});

app.use("/admin/queues", requireAdminAuth, serverAdapter.getRouter());
```
This gives you a live web UI showing waiting/active/completed/failed jobs per
queue, retry counts, and the ability to manually retry or inspect failed
payloads — exactly what Flower gives Celery users, with zero Python.

### 6.7 What moves off the request/response path
| Job | Trigger | Queue |
|---|---|---|
| Expense email dispatch | New group expense created | `email-queue` |
| CSV export generation | User clicks "CSV" export | `csv-export-queue` |
| FX rate refresh | Every 5 minutes (repeatable job) | `fx-refresh-queue` |
| Notification fan-out to SSE | New expense / debt settled | `notification-queue` |

---

## 7. SSE — Replace/Augment Supabase Realtime for Notifications

Supabase Realtime works, but at scale you'll want a dedicated SSE gateway you
control, backed by Redis pub/sub, decoupled from your DB provider.

```javascript
// sse-gateway/server.js
import express from "express";
import Redis from "ioredis";

const app = express();
const sub = new Redis(process.env.REDIS_URL);

app.get("/events/:userEmail", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  const channel = `notifications:${req.params.userEmail}`;
  const handler = (chan, message) => {
    if (chan === channel) res.write(`data: ${message}\n\n`);
  };
  sub.subscribe(channel);
  sub.on("message", handler);

  req.on("close", () => {
    sub.unsubscribe(channel);
    sub.off("message", handler);
  });
});

export default app;
```

Frontend swaps its Supabase Realtime subscription for:
```javascript
const es = new EventSource(`/events/${encodeURIComponent(userEmail)}`);
es.onmessage = (e) => updateNotifications(JSON.parse(e.data));
```

Why SSE over WebSockets here: notifications are server→client only, SSE
auto-reconnects natively, and it plays nicer with HTTP/2 load balancers and
Kubernetes ingress than raw WebSockets do.

---

## 8. Kafka — Event Backbone (only once you have multiple consumers)

Kafka earns its complexity when **more than one system** needs to react to the
same event independently. In Expezplit that's already true: a new expense
should trigger (1) an in-app notification, (2) an email, (3) an analytics
update, (4) an audit log entry.

### Topics
```
expense.created
expense.deleted
debt.settled
group.created
member.joined
```

### Producer (api-gateway, on expense creation)
```javascript
import { Kafka } from "kafkajs";
const kafka = new Kafka({ clientId: "api-gateway", brokers: ["kafka:9092"] });
const producer = kafka.producer();

await producer.send({
  topic: "expense.created",
  messages: [{ key: groupId, value: JSON.stringify(expensePayload) }],
});
```

### Consumers (independent deployments, each with its own consumer group)
```javascript
// consumers/notification-fanout/index.js
const consumer = kafka.consumer({ groupId: "notification-fanout" });
await consumer.subscribe({ topic: "expense.created" });
await consumer.run({
  eachMessage: async ({ message }) => {
    const expense = JSON.parse(message.value.toString());
    await redis.publish(`notifications:${expense.payerEmail}`, JSON.stringify(expense));
  },
});
```
```javascript
// consumers/analytics-aggregator/index.js — separate consumer group, reads same topic
await consumer.run({
  eachMessage: async ({ message }) => {
    await updateSpendingAggregates(JSON.parse(message.value.toString()));
  },
});
```

This decouples "an expense was created" from "everything that needs to happen
because of it" — each consumer can fail, restart, or scale independently
without blocking the others or the original request.

**Honest note:** at 50 users/minute, a Redis pub/sub or a BullMQ job is
probably sufficient and Kafka is genuine overkill. Kafka becomes worth its
operational cost once you have several independent teams/services consuming
the same event stream, or need durable replay of events for auditing. Include
it if this is a learning/portfolio goal; otherwise it's fine to defer.

---

## 9. Observability — Prometheus + Grafana + Sentry

### 9.1 Prometheus scrape config
```yaml
# monitoring/prometheus.yml
scrape_configs:
  - job_name: "api-gateway"
    static_configs: [{ targets: ["api-gateway:4000"] }]
  - job_name: "worker"
    static_configs: [{ targets: ["worker:9100"] }]
  - job_name: "sse-gateway"
    static_configs: [{ targets: ["sse-gateway:4001"] }]
```

Expose metrics from each Node service with `prom-client`:
```javascript
import client from "prom-client";
client.collectDefaultMetrics();

const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Request duration",
  labelNames: ["method", "route", "status"],
});

app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});
```

### 9.2 Grafana dashboards to build
- **Request throughput & latency** (p50/p95/p99) per service
- **Queue depth over time** (BullMQ jobs waiting/active/failed)
- **Kafka consumer lag** per topic/group
- **Redis memory & hit/miss ratio**
- **Email delivery success rate** (mirrors your existing 99.4% benchmark)
- **Pod CPU/memory vs. HPA scaling events**

### 9.3 Sentry — error tracking across every service
```javascript
// each service's entrypoint
import * as Sentry from "@sentry/node";
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.2,
});
app.use(Sentry.Handlers.requestHandler());
// ...routes...
app.use(Sentry.Handlers.errorHandler());
```
Tag events with `service: "worker"`, `service: "sse-gateway"`, etc. so you can
filter by which piece of the system is failing — critical once you have five+
independently deployable services instead of one monolith.

---

## 10. Updated Full Technology Stack

| Layer | Tool | Purpose |
|---|---|---|
| Containerization | **Docker** | Package each service (frontend, api-gateway, sse-gateway, worker, email-service) independently |
| Orchestration | **Kubernetes** (+ KEDA) | Rolling deploys, self-healing, autoscaling on CPU *and* queue depth |
| Caching / Rate limiting / Pub-Sub | **Redis** | Shared state across stateless pods, SSE fan-out, BullMQ backend |
| Async jobs | **BullMQ** (Node-native, Redis-backed) | Email sending, CSV export, FX refresh, retries with backoff — no Python |
| Real-time push | **SSE Gateway** (custom, Redis-backed) | Replaces/augments Supabase Realtime for notifications |
| Event backbone | **Kafka** (optional at this scale) | Decouple "event happened" from "who reacts to it" |
| Metrics | **Prometheus** | Time-series metrics from every service |
| Dashboards | **Grafana** | Visualize throughput, latency, queue depth, error rates |
| Error tracking | **Sentry** | Cross-service exception capture and alerting |
| Database | Supabase PostgreSQL (unchanged) | Source of truth, RLS-protected |
| Auth | Clerk (unchanged) | Identity, session management |

---

## 11. Migration Plan (Incremental, Not Big-Bang)

Don't rewrite everything at once. Suggested order:

1. **Dockerize** the existing frontend, API, and email server as-is (no logic
   changes) — get `docker-compose up` working locally first.
2. **Add Redis** for rate limiting and FX-rate caching — immediate win, low risk.
3. **Move email sending to BullMQ** — decouples the slow SMTP call from the
   request path, adds automatic retries (your current sync-ish dispatch has none).
4. **Add Prometheus + Grafana + Sentry** — you want visibility *before* you add
   more moving parts, not after something breaks in production.
5. **Deploy to Kubernetes** (start with a single-node cluster like k3s or a
   managed one — EKS/GKE/DigitalOcean Kubernetes) — migrate one service at a time.
6. **Build the SSE gateway** — swap it in behind a feature flag, keep Supabase
   Realtime as fallback until confidence is high.
7. **Add Kafka** only if/when you have a second or third consumer that
   genuinely needs the same event stream (analytics, audit log, ML pipeline).

---

## 12. Cost & Complexity Tradeoff Table

| Addition | Operational Cost | Value at 50 users/min | Value at 5,000 users/min |
|---|---|---|---|
| Docker | Low | High (dev/prod parity) | High |
| Kubernetes | Medium-High (needs someone to own it) | Medium (mostly for learning/resilience) | High |
| Redis | Low | High | High |
| BullMQ | Low | High | High |
| SSE Gateway | Low-Medium | Medium | High |
| Kafka | High | Low (overkill) | High |
| Prometheus/Grafana | Low-Medium | Medium (great for learning) | High |
| Sentry | Low | High (cheap insurance) | High |

---

## 13. Managed Alternatives (Reduce Ops Burden)

If you don't want to run Redis/Kafka yourself on Kubernetes:
- **Redis** → Upstash, Redis Cloud, AWS ElastiCache
- **Kafka** → Confluent Cloud, AWS MSK, Upstash Kafka
- **Kubernetes** → managed clusters (GKE Autopilot, EKS, DigitalOcean) instead
  of self-hosting the control plane
- **Grafana** → Grafana Cloud (free tier covers small deployments)
- **Sentry** → Sentry's own hosted SaaS (generous free tier)

This lets you get the enterprise architecture's benefits without becoming a
full-time infrastructure team of one.
