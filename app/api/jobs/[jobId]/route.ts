import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getJobById, cancelJob } from "@/services/job-service";

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
  return NextResponse.json(job);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { jobId } = await params;
  const ok = await cancelJob(jobId, session.sub);
  if (!ok) {
    return NextResponse.json({ error: "Job not found or cannot be cancelled" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
