# Load Testing SaaS — System Architecture

## 1. System Architecture (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                     │
│  • Dashboard UI • Test config • Real-time metrics (SSE/WebSocket) • Reports       │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS APP (API + SSR)                                   │
│  • Auth (JWT) • Rate limiting • API routes • Server actions • PDF export          │
└─────────────────────────────────────────────────────────────────────────────────┘
                    │                    │                      │
                    ▼                    ▼                      ▼
        ┌───────────────┐    ┌──────────────────┐    ┌─────────────────────┐
        │  PostgreSQL   │    │  Redis           │    │  Load Engine Workers │
        │  • Users      │    │  • BullMQ queues │    │  (Node worker_threads│
        │  • Jobs       │    │  • Rate limits   │    │   or separate        │
        │  • Results    │    │  • Sessions      │    │   containers)        │
        │  • Domains    │    │  • Real-time     │    │  • HTTP client pool  │
        └───────────────┘    │    metrics       │    │  • Metrics stream    │
                             └──────────────────┘    └─────────────────────┘
                                        │                      │
                                        └──────────┬───────────┘
                                                   ▼
                                        ┌──────────────────────┐
                                        │  Metrics Aggregator  │
                                        │  (stream → Redis/DB) │
                                        └──────────────────────┘
```

- **Next.js** serves the UI and REST API; auth and rate limiting sit at the edge (middleware + API).
- **PostgreSQL** stores users, plans, jobs, test results, and verified domains.
- **Redis** backs BullMQ (job queue), rate-limit counters, and optional real-time metric buffers.
- **Load engine** runs as BullMQ workers (same process or separate Node containers); each worker runs a pool of virtual users and streams metrics back to Redis/API for aggregation.

---

## 2. Distributed Load Generator System

- **Unit of work**: One **load test job** = one BullMQ job. Parameters: `url`, `method`, `concurrency`, `durationSeconds`, `headers`, `body`, `userId`, `jobId`.
- **Execution model**:
  - **Single-node**: One Next.js process runs BullMQ workers; each job is handled by one worker that spawns N virtual users (e.g. via `worker_threads` or an internal async pool).
  - **Multi-node**: Multiple **load-engine** containers (or separate processes) run only BullMQ workers and connect to the same Redis + DB. Next.js app does not run workers; it only enqueues jobs. Workers pull jobs from Redis and run the load; they push metrics to Redis streams or a central aggregator.
- **Virtual users**: Implemented as concurrent async HTTP requests (no 1:1 OS threads). Cap per worker (e.g. 2_000–5_000) to avoid memory/connection exhaustion; scale by adding more worker containers.
- **HTTP client**: Use a single `undici` Pool or `node:http` with keep-alive and connection limits per target origin. Reuse connections; respect concurrency and duration limits.

---

## 3. Job Queue Mechanism (BullMQ)

- **Queue**: `load-test-jobs` (single queue for all load test jobs).
- **Flow**:
  1. API validates request (URL, method, concurrency, duration, plan limits, domain allowlist).
  2. Create `load_test_jobs` row (status `queued`), then add BullMQ job with `jobId`, `userId`, and test config.
  3. Worker picks job, updates status to `running`, starts load engine, streams metrics (e.g. to Redis stream or in-memory aggregator), then on finish writes summary to `load_test_results` and sets job status `completed` / `failed`.
  4. Dashboard subscribes to real-time metrics (SSE backed by Redis or in-memory store keyed by `jobId`) and shows historical results from DB.
- **Retries**: Optional 0–1 retry for transient failures; no retry for validation/abuse.
- **Rate limit**: Enforce max concurrent jobs per user/plan in the API before enqueueing.

---

## 4. Horizontal Scaling Strategy

- **Next.js**: Stateless; scale behind a load balancer. No in-memory job state.
- **Workers**: Scale by adding more instances that run BullMQ workers (same Redis queue). Each worker processes one job at a time (or a small concurrency per worker) to avoid overloading one machine.
- **Redis**: Single instance or cluster; BullMQ and rate limiting work with both. For very high throughput, use Redis Streams for metrics and multiple consumers.
- **PostgreSQL**: Connection pooling (e.g. PgBouncer); read replicas optional for reporting.
- **Metrics aggregation**: Workers push to Redis Stream or a dedicated metrics service; one aggregator (or sharded by `jobId`) computes RPS, p95, p99, error rate and writes to DB and/or broadcasts to SSE.

---

## 5. Rate Limiting Safeguards

- **API rate limit**: Per user (or IP if unauthenticated): e.g. 60 req/min for auth endpoints, 30 req/min for create-job, 300 req/min for read endpoints. Use Redis sliding window or fixed window.
- **Job creation**: Max N jobs per user per day (and per plan); max concurrent running jobs per user. Enforced in API before enqueueing.
- **Concurrency cap**: Per plan (e.g. free: 100, pro: 2_000, enterprise: 10_000). Enforced in API.
- **Duration cap**: Per plan (e.g. max 5 min, 30 min). Enforced in API.

---

## 6. Abuse Prevention System

- **URL validation**: Only `http`/`https`; block private IP ranges (SSRF), localhost, and internal hostnames (see blocklist below).
- **Domain verification**: For production, require users to prove ownership (e.g. DNS TXT or meta tag); store verified domains in `verified_domains`; only allow tests to verified domains (or allow unverified with strict caps and warning).
- **Abuse detection**: Track failed tests, high error rates, and repeat targets; flag or throttle users. Optional: admin review queue for new domains.
- **Ethical use**: Mandatory confirmation checkbox and warning banner; terms of use; log job config and user for audit.

---

## 7. Database Schema (PostgreSQL)

- **users**: id, email, password_hash, name, plan_id, created_at, updated_at.
- **plans**: id, name, max_concurrency, max_duration_seconds, max_jobs_per_day, max_tests_per_month.
- **verified_domains**: id, user_id, domain, verification_token, verified_at, created_at.
- **load_test_jobs**: id, user_id, status (queued|running|completed|failed|cancelled), target_url, method, concurrency, duration_seconds, request_headers (jsonb), request_body (text), created_at, started_at, completed_at, error_message.
- **load_test_results**: id, job_id, total_requests, successful_requests, failed_requests, requests_per_second_avg, response_time_avg_ms, response_time_p95_ms, response_time_p99_ms, error_rate, throughput_bytes_per_sec, raw_metrics (jsonb), created_at.
- **load_test_metrics_samples** (optional, for time-series): id, job_id, bucket_ts (e.g. per second), rps, avg_latency_ms, error_count. Use for detailed charts; can be partitioned by job_id or time.

Indexes: `load_test_jobs(user_id, created_at)`, `load_test_jobs(status)`, `load_test_results(job_id)`, `verified_domains(user_id, domain)`.

---

## 8. Reporting Architecture

- **Real-time**: Worker emits metrics (e.g. every 1s) to Redis stream or in-memory store; API exposes SSE endpoint keyed by `jobId`; dashboard subscribes and renders with Recharts.
- **Historical**: Summary stored in `load_test_results`; optional `load_test_metrics_samples` for per-second curves. PDF report generated from `load_test_results` (and optional samples) via a server action or background job (e.g. Puppeteer or jsPDF).
- **Admin**: List users, jobs, domains; view metrics; suspend users; view abuse flags.

---

## 9. Folder Structure

```
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── tests/
│   │   │   ├── new/
│   │   │   └── [jobId]/
│   │   ├── history/
│   │   └── settings/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   └── me/route.ts
│   │   ├── jobs/
│   │   │   ├── route.ts          (POST create, GET list)
│   │   │   ├── [jobId]/route.ts  (GET one, DELETE cancel)
│   │   │   └── [jobId]/metrics/route.ts  (SSE stream)
│   │   ├── results/
│   │   │   └── [jobId]/report/route.ts   (PDF download)
│   │   └── admin/
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/           (Shadcn)
│   ├── dashboard/
│   ├── charts/
│   └── layout/
├── lib/
│   ├── db/
│   │   ├── db.ts
│   │   └── schema.ts
│   ├── redis.ts
│   ├── queue.ts
│   ├── auth.ts
│   ├── load-engine/
│   │   ├── runner.ts
│   │   ├── metrics.ts
│   │   └── http-client.ts
│   ├── validation/
│   │   └── load-test.ts
│   └── security/
│       ├── url-validator.ts
│       └── blocklist.ts
├── workers/
│   └── load-test-worker.ts
├── services/
│   ├── auth-service.ts
│   ├── job-service.ts
│   ├── metrics-service.ts
│   └── report-service.ts
├── middleware.ts
├── db/
│   ├── schema.ts
│   └── db.ts
├── drizzle/
├── docs/
│   └── ARCHITECTURE.md
├── docker-compose.yml
├── Dockerfile
└── Dockerfile.worker
```

---

## 10. API Contracts (Summary)

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/register | Register (email, password, name) |
| POST | /api/auth/login | Login → JWT |
| GET | /api/auth/me | Current user (JWT) |
| POST | /api/jobs | Create load test job (body: url, method, concurrency, durationSeconds, headers?, body?) |
| GET | /api/jobs | List user's jobs (paginated) |
| GET | /api/jobs/[jobId] | Get job + result summary |
| DELETE | /api/jobs/[jobId] | Cancel job (if queued/running) |
| GET | /api/jobs/[jobId]/metrics | SSE stream of real-time metrics |
| GET | /api/results/[jobId]/report | PDF report download |
| GET | /api/domains | List verified domains |
| POST | /api/domains/verify | Start domain verification |
| (Admin) | /api/admin/* | Users, jobs, abuse flags |

---

## 11. Load Testing Engine Logic

- **Input**: target URL, method, concurrency, duration (seconds), optional headers/body.
- **Process**:
  1. Resolve URL (must pass SSRF/blocklist check).
  2. Create HTTP client pool (keep-alive, max connections per origin).
  3. Start timer for `duration` seconds.
  4. Spawn `concurrency` async “virtual users”: each in a loop sends request → record latency and status → repeat until time elapsed.
  5. Aggregate every 1s: count requests, successes, failures, latencies; compute RPS, avg, p95, p99; push to metrics channel/Redis.
  6. On finish: compute final aggregates, return summary (and persist to DB in worker).
- **Backpressure**: Limit in-flight requests per worker to avoid OOM; use a semaphore or bounded queue.

---

## 12. Distributed Worker Model

- **BullMQ worker**: One process (or container) runs `Worker('load-test-jobs', processor, { connection: redis })`. Concurrency: 1 or N (N = small, e.g. 2–4) so one machine runs N tests in parallel.
- **Processor**: Receive job payload (jobId, url, method, concurrency, duration, etc.); run load engine; stream metrics to Redis (e.g. stream key `metrics:{jobId}`); on done, write to `load_test_results`, update `load_test_jobs.status`.
- **Scaling**: Run multiple worker containers; all consume from same queue. No shared in-memory state; Redis and PostgreSQL are the source of truth.

---

## 13. Security: SSRF and Blocklist

- **Blocked**: localhost, 127.0.0.0/8, 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, link-local, metadata endpoints (169.254.0.0/16, etc.), internal hostnames (e.g. *.local, *.internal). Reject on URL parse and on resolved IP before sending any request.
- **Domain verification**: Before allowing high concurrency or sensitive targets, require TXT record or HTML meta tag; store in `verified_domains` and only allow tests to those domains when verification is enabled.

This document is the single source of truth for the load testing SaaS before implementation.

---

## Quick start

1. **Environment**: Copy `.env.example` to `.env` and set `DATABASE_URL`, `REDIS_URL`, and `JWT_SECRET`.
2. **Database**: Start Postgres (e.g. `docker-compose up -d postgres`), then `npm run db:push` and `npm run db:seed`.
3. **Redis**: Start Redis (e.g. `docker-compose up -d redis`).
4. **App**: `npm run dev` for the Next.js app.
5. **Worker**: In a separate terminal, `npm run worker` to process load test jobs.
6. **Use**: Register, create a load test (URL, concurrency, duration), open the job page for real-time metrics, and download the report when complete.
