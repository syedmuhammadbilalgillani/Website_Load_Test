import { db } from "@/db/db";
import { loadTestJobs, loadTestResults, plans } from "@/db/schema";
import { eq, and, desc, sql, gte, inArray } from "drizzle-orm";

/** Compare job id as text so it works whether DB has uuid or integer. */
function jobIdCondition(jobId: string) {
  return sql`${loadTestJobs.id}::text = ${jobId}`;
}
import { getLoadTestQueue } from "@/lib/queue";
import type { CreateLoadTestInput } from "@/lib/validation/load-test";
import { validateTargetUrl } from "@/lib/security/url-validator";

export type JobWithResult = typeof loadTestJobs.$inferSelect & {
  result?: typeof loadTestResults.$inferSelect | null;
};

export async function createJob(
  userId: string,
  planId: string,
  input: CreateLoadTestInput
): Promise<JobWithResult> {
  const validation = validateTargetUrl(input.url);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const [plan] = await db.select().from(plans).where(eq(plans.id, planId));
  if (!plan) throw new Error("Plan not found");
  if (input.concurrency > plan.maxConcurrency) {
    throw new Error(`Max concurrency for your plan is ${plan.maxConcurrency}`);
  }
  if (input.durationSeconds > plan.maxDurationSeconds) {
    throw new Error(`Max duration for your plan is ${plan.maxDurationSeconds}s`);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const jobsToday = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loadTestJobs)
    .where(and(eq(loadTestJobs.userId, userId), gte(loadTestJobs.createdAt, today)));
  const countToday = jobsToday[0]?.count ?? 0;
  if (countToday >= plan.maxJobsPerDay) {
    throw new Error(`Daily job limit (${plan.maxJobsPerDay}) reached`);
  }

  const [job] = await db
    .insert(loadTestJobs)
    .values({
      userId,
      targetUrl: validation.url,
      method: input.method,
      concurrency: input.concurrency,
      durationSeconds: input.durationSeconds,
      requestHeaders: input.requestHeaders ?? null,
      requestBody: input.requestBody ?? null,
    })
    .returning();
  if (!job) throw new Error("Failed to create job");

  const jobIdStr = String(job.id);

  const queue = getLoadTestQueue();
  await queue.add(
    "run",
    {
      jobId: jobIdStr,
      userId,
      targetUrl: validation.url,
      method: input.method,
      concurrency: input.concurrency,
      durationSeconds: input.durationSeconds,
      requestHeaders: input.requestHeaders,
      requestBody: input.requestBody,
    },
    { jobId: jobIdStr }
  );

  return job;
}

export async function getJobById(jobId: string, userId: string): Promise<JobWithResult | null> {
  const [job] = await db
    .select()
    .from(loadTestJobs)
    .where(and(jobIdCondition(jobId), eq(loadTestJobs.userId, userId)))
    .limit(1);
  if (!job) return null;
  const [result] = await db
    .select()
    .from(loadTestResults)
    .where(eq(loadTestResults.jobId, job.id))
    .limit(1);
  return { ...job, result: result ?? null };
}

export async function listJobs(
  userId: string,
  page: number,
  pageSize: number
): Promise<{ jobs: JobWithResult[]; total: number }> {
  const offset = (page - 1) * pageSize;
  const jobs = await db
    .select()
    .from(loadTestJobs)
    .where(eq(loadTestJobs.userId, userId))
    .orderBy(desc(loadTestJobs.createdAt))
    .limit(pageSize)
    .offset(offset);
  const jobIds = jobs.map((j) => j.id);
  const results =
    jobIds.length > 0
      ? await db.select().from(loadTestResults).where(inArray(loadTestResults.jobId, jobIds))
      : [];
  const resultByJobId = new Map(results.map((r) => [r.jobId, r]));
  const jobsWithResult: JobWithResult[] = jobs.map((job) => ({
    ...job,
    result: resultByJobId.get(job.id) ?? null,
  }));
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loadTestJobs)
    .where(eq(loadTestJobs.userId, userId));
  return { jobs: jobsWithResult, total: Number(count) || 0 };
}

export async function cancelJob(jobId: string, userId: string): Promise<boolean> {
  const [job] = await db
    .select()
    .from(loadTestJobs)
    .where(and(jobIdCondition(jobId), eq(loadTestJobs.userId, userId)));
  if (!job || (job.status !== "queued" && job.status !== "running")) return false;
  await db
    .update(loadTestJobs)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(jobIdCondition(jobId));
  return true;
}
