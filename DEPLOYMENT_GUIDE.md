# 🚀 Expezplit — Complete Free-Tier Production Deployment Guide

This guide walks you through deploying the entire **Expezplit** application with all features (Auth, Supabase DB, BullMQ async queues, Redis cache & rate limiting, real-time events, and email notifications) for **$0/month** using industry-standard free tiers.

---

## 🏛️ Free-Tier Architecture Overview

```
 ┌──────────────────────────────────────────────────────────┐
 │               User's Browser / Mobile Web                │
 └────────────────────────────┬─────────────────────────────┘
                              │
               ┌──────────────┴──────────────┐
               │                             │
     Static UI Requests              API Requests & Jobs
               │                             │
               ▼                             ▼
   ┌───────────────────────┐     ┌───────────────────────┐
   │   Cloudflare Pages    │     │      Render.com       │
   │      or Vercel        │     │   Free Web Service    │
   │  (React 19 + Vite)    │     │  (API Gateway + Queue)│
   └───────────┬───────────┘     └───────────┬───────────┘
               │                             │
               │  Direct client operations   │  Queue, Cache, Pub/Sub
               │  (Auth & DB queries)        │
               ▼                             ▼
   ┌───────────────────────┐     ┌───────────────────────┐
   │    Clerk + Supabase   │     │     Upstash Redis     │
   │  Auth & PostgreSQL DB │     │  Serverless Redis TLS │
   └───────────────────────┘     └───────────────────────┘
```

| Component | Provider | Free Tier Limits | Cost |
|---|---|---|---|
| **Frontend** | **Cloudflare Pages** or **Vercel** | Unlimited bandwidth, global edge CDN, automatic SSL | **$0** |
| **Backend & Worker** | **Render.com** | 750 free instance hours/month | **$0** |
| **Redis & Queues** | **Upstash Redis** | 10,000 commands/day, 256MB storage | **$0** |
| **Database** | **Supabase** | 500MB PostgreSQL, Auth, Realtime | **$0** |
| **Authentication** | **Clerk** | 10,000 monthly active users | **$0** |

---

## Step 1: Set Up Upstash Redis (2 Minutes)

You already have the Upstash tab open in your browser!

1. In the **Upstash Console** ([console.upstash.com](https://console.upstash.com/)):
   - Click **"Create Database"**.
   - **Name**: `expezplit-redis`
   - **Type**: Regional (select the region closest to your users or Render region, e.g. `us-east-1` or `ap-southeast-1`).
   - Click **"Create"**.
2. Scroll down to the **"Connect to your database"** section:
   - Click on the **"ioredis"** or **"Node.js"** tab.
   - Copy the connection URL. It will look like this:
     ```text
     rediss://default:your_password@your-endpoint.upstash.io:6379
     ```
   *(Note the `rediss://` with double `s` for secure TLS).*

---

## Step 2: Push Your Latest Code to GitHub

Make sure your latest changes (including the deployment configurations and fixes) are committed and pushed to your GitHub repository:

```powershell
git add .
git commit -m "feat: complete scaling architecture, docker parity, and free tier deployment config"
git push origin main
```

---

## Step 3: Deploy Backend on Render.com (3 Minutes)

1. Log in to **[dashboard.render.com](https://dashboard.render.com/)**.
2. Click **New +** → **Web Service**.
3. Select **"Build and deploy from a Git repository"** and select your `Expezplit` repository.
4. Configure the Web Service settings:
   - **Name**: `expezplit-backend` (or your preferred name)
   - **Region**: Oregon or Frankfurt (pick closest to your Upstash Redis region)
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: **Free**
5. Click **"Advanced"** → **Add Environment Variable** and add the following keys:

   | Key | Value | Description |
   |---|---|---|
   | `NODE_ENV` | `production` | Production mode |
   | `EMBEDDED_WORKER` | `true` | **Crucial for Free Tier**: Runs BullMQ workers inside the web process |
   | `REDIS_URL` | `rediss://default:***@***.upstash.io:6379` | Your Upstash Redis URL from Step 1 |
   | `EMAIL` | `expezplit@gmail.com` | Your Gmail address |
   | `APP_PASSWORD` | `vuwefugcmjhrmntt` | Your Google App Password |
   | `RATE_LIMIT_POINTS` | `50` | Max requests per minute per IP |
   | `RATE_LIMIT_DURATION` | `60` | Rate limit window in seconds |
   | `EXCHANGE_RATE_API_KEY` | `c1ecaa39d4a7684bd556df77` | ExchangeRate API key |

6. Click **"Deploy Web Service"**.
7. Wait 1–2 minutes for the build to finish. Once live, Render will provide your public URL:
   ```text
   https://expezplit-backend.onrender.com
   ```
   Test it by opening:
   `https://expezplit-backend.onrender.com/api/health`
   You should see: `{"status":"ok","service":"api-gateway",...}`.

---

## Step 4: Deploy Frontend on Cloudflare Pages or Vercel (2 Minutes)

### Option A: Cloudflare Pages (Recommended)
1. Go to **[dash.cloudflare.com](https://dash.cloudflare.com/)** → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select your `Expezplit` repository.
3. In **Build Settings**:
   - **Framework preset**: `Vite`
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `frontend`
4. Expand **Environment variables** and add:

   | Variable Name | Value |
   |---|---|
   | `VITE_CLERK_PUBLISHABLE_KEY` | `pk_test_cG9zc2libGUtaW5zZWN0LTgxLmNsZXJrLmFjY291bnRzLmRldiQ` |
   | `VITE_SUPABASE_URL` | `https://nmcftszvnaqdheapjmap.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
   | `VITE_EXCHANGE_RATE_API_KEY` | `c1ecaa39d4a7684bd556df77` |
   | `VITE_EMAIL_API_URL` | `https://expezplit-backend.onrender.com` *(your Render URL from Step 3)* |

5. Click **"Save and Deploy"**.

---

### Option B: Vercel
1. Go to **[vercel.com/new](https://vercel.com/new)** and import your GitHub repository.
2. Under **Root Directory**, click **Edit** and choose `frontend`.
3. Framework Preset will auto-detect as **Vite**.
4. Expand **Environment Variables** and paste the 5 `VITE_*` keys listed above.
5. Click **Deploy**.

---

## Step 5: Verification Checklist

Once deployed, verify your live system:

- [ ] Open your live frontend URL (e.g. `https://expezplit.pages.dev` or `https://expezplit.vercel.app`).
- [ ] Log in with Clerk.
- [ ] Create a group expense.
- [ ] Check that the email is dispatched through BullMQ asynchronously.
- [ ] Open Upstash Redis Data Browser: You will see BullMQ keys (`bull:email-queue:...`, `bull:fx-refresh-queue:...`) and cached FX exchange rates!
- [ ] Open `https://expezplit-backend.onrender.com/metrics` to inspect live Prometheus metrics.

---

## Summary of Files Prepared

- `render.yaml`: Blueprint definition for 1-click Render setup.
- `backend/package.json`: Configured with `postinstall` to auto-install all microservice packages on cloud build.
- `backend/shared/redis.js`: Upstash TLS (`rediss://`) and authentication support enabled.
- `backend/api-gateway/server.js`: Supports `EMBEDDED_WORKER=true` to run BullMQ queues inside a single free-tier container without needing paid background worker plans.
