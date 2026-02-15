import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobById } from "@/services/job-service";
import { db } from "@/db/db";
import { loadTestResults } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const job = await getJobById(jobId, session.sub);
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  const [result] = await db
    .select()
    .from(loadTestResults)
    .where(eq(loadTestResults.jobId, jobId));
  if (!result) {
    return NextResponse.json({ error: "No results yet" }, { status: 404 });
  }

  const report = {
    jobId: job.id,
    targetUrl: job.targetUrl,
    method: job.method,
    concurrency: job.concurrency,
    durationSeconds: job.durationSeconds,
    status: job.status,
    completedAt: job.completedAt,
    totalRequests: result.totalRequests,
    successfulRequests: result.successfulRequests,
    failedRequests: result.failedRequests,
    requestsPerSecondAvg: result.requestsPerSecondAvg,
    responseTimeAvgMs: result.responseTimeAvgMs,
    responseTimeP95Ms: result.responseTimeP95Ms,
    responseTimeP99Ms: result.responseTimeP99Ms,
    errorRate: (result.errorRate / 100).toFixed(2) + "%",
    throughputBytesPerSec: result.throughputBytesPerSec,
  };

  return NextResponse.json(report, {
    headers: {
      "Content-Disposition": `attachment; filename="load-test-${jobId}.json"`,
    },
  });
}
