CREATE TYPE "public"."job_status" AS ENUM('queued', 'running', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TABLE "load_test_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"status" "job_status" DEFAULT 'queued' NOT NULL,
	"target_url" text NOT NULL,
	"method" text DEFAULT 'GET' NOT NULL,
	"concurrency" integer NOT NULL,
	"duration_seconds" integer NOT NULL,
	"request_headers" jsonb,
	"request_body" text,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "load_test_metrics_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"bucket_ts" timestamp with time zone NOT NULL,
	"rps" integer DEFAULT 0 NOT NULL,
	"avg_latency_ms" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "load_test_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"total_requests" integer DEFAULT 0 NOT NULL,
	"successful_requests" integer DEFAULT 0 NOT NULL,
	"failed_requests" integer DEFAULT 0 NOT NULL,
	"requests_per_second_avg" integer DEFAULT 0 NOT NULL,
	"response_time_avg_ms" integer DEFAULT 0 NOT NULL,
	"response_time_p95_ms" integer,
	"response_time_p99_ms" integer,
	"error_rate" integer DEFAULT 0 NOT NULL,
	"throughput_bytes_per_sec" integer,
	"raw_metrics" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "load_test_results_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"max_concurrency" integer DEFAULT 100 NOT NULL,
	"max_duration_seconds" integer DEFAULT 60 NOT NULL,
	"max_jobs_per_day" integer DEFAULT 10 NOT NULL,
	"max_tests_per_month" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"plan_id" text DEFAULT 'free' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verified_domains" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text NOT NULL,
	"verification_token" text NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "load_test_jobs" ADD CONSTRAINT "load_test_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_test_metrics_samples" ADD CONSTRAINT "load_test_metrics_samples_job_id_load_test_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."load_test_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "load_test_results" ADD CONSTRAINT "load_test_results_job_id_load_test_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."load_test_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verified_domains" ADD CONSTRAINT "verified_domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "load_test_jobs_user_created_idx" ON "load_test_jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "load_test_jobs_status_idx" ON "load_test_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "load_test_metrics_samples_job_ts_idx" ON "load_test_metrics_samples" USING btree ("job_id","bucket_ts");--> statement-breakpoint
CREATE INDEX "verified_domains_user_domain_idx" ON "verified_domains" USING btree ("user_id","domain");--> statement-breakpoint
CREATE INDEX "verified_domains_domain_idx" ON "verified_domains" USING btree ("domain");