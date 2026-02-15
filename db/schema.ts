import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type JobStatus = (typeof jobStatusEnum.enumValues)[number];

// --------------------------------------------
// Plans (tiers for rate limits and caps)
// --------------------------------------------
export const plans = pgTable("plans", {
  id: text("id").primaryKey(), // free | pro | enterprise
  name: text("name").notNull(),
  maxConcurrency: integer("max_concurrency").notNull().default(100),
  maxDurationSeconds: integer("max_duration_seconds").notNull().default(60),
  maxJobsPerDay: integer("max_jobs_per_day").notNull().default(10),
  maxTestsPerMonth: integer("max_tests_per_month"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --------------------------------------------
// Users
// --------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  planId: text("plan_id")
    .notNull()
    .default("free")
    .references(() => plans.id),
  isActive: boolean("is_active").notNull().default(true),
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  plan: one(plans),
  verifiedDomains: many(verifiedDomains),
  loadTestJobs: many(loadTestJobs),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  users: many(users),
}));

// --------------------------------------------
// Verified domains (ownership verification)
// --------------------------------------------
export const verifiedDomains = pgTable(
  "verified_domains",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    domain: text("domain").notNull(),
    verificationToken: text("verification_token").notNull(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("verified_domains_user_domain_idx").on(t.userId, t.domain),
    index("verified_domains_domain_idx").on(t.domain),
  ]
);

export const verifiedDomainsRelations = relations(verifiedDomains, ({ one }) => ({
  user: one(users),
}));

// --------------------------------------------
// Load test jobs
// --------------------------------------------
export const loadTestJobs = pgTable(
  "load_test_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: jobStatusEnum("status").notNull().default("queued"),
    targetUrl: text("target_url").notNull(),
    method: text("method").notNull().default("GET"),
    concurrency: integer("concurrency").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    requestHeaders: jsonb("request_headers").$type<Record<string, string>>(),
    requestBody: text("request_body"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("load_test_jobs_user_created_idx").on(t.userId, t.createdAt),
    index("load_test_jobs_status_idx").on(t.status),
  ]
);

export const loadTestJobsRelations = relations(loadTestJobs, ({ one, many }) => ({
  user: one(users),
  result: one(loadTestResults, {
    fields: [loadTestJobs.id],
    references: [loadTestResults.jobId],
  }),
  metricsSamples: many(loadTestMetricsSamples),
}));

// --------------------------------------------
// Load test results (summary per job)
// --------------------------------------------
export const loadTestResults = pgTable("load_test_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobId: uuid("job_id")
    .notNull()
    .unique()
    .references(() => loadTestJobs.id, { onDelete: "cascade" }),
  totalRequests: integer("total_requests").notNull().default(0),
  successfulRequests: integer("successful_requests").notNull().default(0),
  failedRequests: integer("failed_requests").notNull().default(0),
  requestsPerSecondAvg: integer("requests_per_second_avg").notNull().default(0),
  responseTimeAvgMs: integer("response_time_avg_ms").notNull().default(0),
  responseTimeP95Ms: integer("response_time_p95_ms"),
  responseTimeP99Ms: integer("response_time_p99_ms"),
  errorRate: integer("error_rate").notNull().default(0), // e.g. 0-10000 for 2 decimals
  throughputBytesPerSec: integer("throughput_bytes_per_sec"),
  rawMetrics: jsonb("raw_metrics").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const loadTestResultsRelations = relations(loadTestResults, ({ one }) => ({
  job: one(loadTestJobs, {
    fields: [loadTestResults.jobId],
    references: [loadTestJobs.id],
  }),
}));

// --------------------------------------------
// Time-series metrics (optional, for charts)
// --------------------------------------------
export const loadTestMetricsSamples = pgTable(
  "load_test_metrics_samples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => loadTestJobs.id, { onDelete: "cascade" }),
    bucketTs: timestamp("bucket_ts", { withTimezone: true }).notNull(),
    rps: integer("rps").notNull().default(0),
    avgLatencyMs: integer("avg_latency_ms").notNull().default(0),
    errorCount: integer("error_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("load_test_metrics_samples_job_ts_idx").on(t.jobId, t.bucketTs)]
);

export const loadTestMetricsSamplesRelations = relations(
  loadTestMetricsSamples,
  ({ one }) => ({
    job: one(loadTestJobs),
  })
);
