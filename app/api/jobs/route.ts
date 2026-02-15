import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createLoadTestSchema,
  quickCreateLoadTestSchema,
  domainToUrl,
} from "@/lib/validation/load-test";
import { createJob, listJobs } from "@/services/job-service";
import { checkCreateJobRateLimit } from "@/lib/rate-limit";

const DEFAULT_DURATION_SECONDS = 30;
const DEFAULT_METHOD = "GET";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20", 10)));
  const { jobs, total } = await listJobs(session.sub, page, pageSize);
  return NextResponse.json({ jobs, total, page, pageSize });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const allowed = await checkCreateJobRateLimit(session.sub);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many jobs created. Please wait a minute." },
      { status: 429 }
    );
  }
  try {
    const body = await request.json();

    // Quick path: only domain + users → auto GET, 30s duration
    const quick = quickCreateLoadTestSchema.safeParse(body);
    if (quick.success) {
      const url = domainToUrl(quick.data.domain);
      const job = await createJob(session.sub, session.planId, {
        url,
        method: DEFAULT_METHOD,
        concurrency: quick.data.users,
        durationSeconds: DEFAULT_DURATION_SECONDS,
      });
      return NextResponse.json({ ...job, id: String(job.id) });
    }

    // Full path: url + method + concurrency + duration
    const parsed = createLoadTestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const job = await createJob(session.sub, session.planId, parsed.data);
    return NextResponse.json({ ...job, id: String(job.id) });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
