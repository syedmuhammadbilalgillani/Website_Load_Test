import "dotenv/config";
import { createLoadTestWorker, type LoadTestJobPayload } from "./../lib/queue";
import { getRedis } from "./../lib/redis";
import { runLoadTest } from "./../lib/load-engine/runner";
import { db } from "./../db/db";
import {
  loadTestJobs,
  loadTestResults,
  loadTestMetricsSamples,
} from "./../db/schema";
import { eq } from "drizzle-orm";
import { validateTargetUrl } from "./../lib/security/url-validator";

const METRICS_KEY_PREFIX = "loadtest:metrics:";
const METRICS_TTL_SEC = 300;

async function processJob(payload: LoadTestJobPayload): Promise<void> {
  const { jobId, userId, targetUrl, method, concurrency, durationSeconds, requestHeaders, requestBody } =
    payload;

  const validation = validateTargetUrl(targetUrl);
  if (!validation.valid) {
    await db
      .update(loadTestJobs)
      .set({
        status: "failed",
        errorMessage: validation.error,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loadTestJobs.id, jobId));
    return;
  }

  await db
    .update(loadTestJobs)
    .set({
      status: "running",
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(loadTestJobs.id, jobId));

  const redis = getRedis();
  const metricsKey = `${METRICS_KEY_PREFIX}${jobId}`;
  const samplesToInsert: { jobId: string; bucketTs: Date; rps: number; avgLatencyMs: number; errorCount: number }[] = [];

  try {
    const final = await runLoadTest({
      targetUrl: validation.url,
      method,
      concurrency,
      durationSeconds,
      requestHeaders,
      requestBody,
      metricsIntervalMs: 1000,
      onMetrics(snapshot) {
        redis.setex(metricsKey, METRICS_TTL_SEC, JSON.stringify(snapshot));
        samplesToInsert.push({
          jobId,
          bucketTs: new Date(snapshot.timestamp),
          rps: Math.round(snapshot.rps),
          avgLatencyMs: snapshot.avgLatencyMs,
          errorCount: snapshot.failedRequests,
        });
      },
    });

    await db.insert(loadTestResults).values({
      jobId,
      totalRequests: final.totalRequests,
      successfulRequests: final.successfulRequests,
      failedRequests: final.failedRequests,
      requestsPerSecondAvg: Math.round(final.rps),
      responseTimeAvgMs: final.avgLatencyMs,
      responseTimeP95Ms: final.p95LatencyMs ?? null,
      responseTimeP99Ms: final.p99LatencyMs ?? null,
      errorRate: Math.round(final.errorRate * 100),
      throughputBytesPerSec: final.throughputBytesPerSec ?? null,
      rawMetrics: final as unknown as Record<string, unknown>,
    });

    if (samplesToInsert.length > 0) {
      const lastFew = samplesToInsert.slice(-60);
      await db.insert(loadTestMetricsSamples).values(
        lastFew.map((s) => ({
          jobId: s.jobId,
          bucketTs: s.bucketTs,
          rps: s.rps,
          avgLatencyMs: s.avgLatencyMs,
          errorCount: s.errorCount,
        }))
      );
    }

    await db
      .update(loadTestJobs)
      .set({
        status: "completed",
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loadTestJobs.id, jobId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(loadTestJobs)
      .set({
        status: "failed",
        errorMessage: message,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(loadTestJobs.id, jobId));
  } finally {
    await redis.del(metricsKey);
  }
}

function main() {
  const worker = createLoadTestWorker(async (job) => processJob(job.data));
  worker.on("completed", (job) => console.log("Job completed", job?.id ?? job));
  worker.on("failed", (job, err) =>
    console.error("Job failed:", job?.id ?? job, err?.message ?? err)
  );
  console.log("Load test worker started. Waiting for jobs...");
}

main();
