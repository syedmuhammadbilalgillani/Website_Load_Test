import { getSession } from "@/lib/auth";
import { getJobById } from "@/services/job-service";
import { getRedis } from "@/lib/redis";

const METRICS_KEY_PREFIX = "loadtest:metrics:";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { jobId } = await params;
  const job = await getJobById(jobId, session.sub);
  if (!job) {
    return new Response("Not found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };
      const interval = setInterval(async () => {
        try {
          const redis = getRedis();
          const key = `${METRICS_KEY_PREFIX}${jobId}`;
          const raw = await redis.get(key);
          if (raw) {
            const data = JSON.parse(raw) as Record<string, unknown>;
            send(data);
          }
          if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
            clearInterval(interval);
            controller.close();
          }
        } catch {
          clearInterval(interval);
          controller.close();
        }
      }, 1000);
      setTimeout(() => {
        clearInterval(interval);
        if (job.status !== "running" && job.status !== "queued") {
          controller.close();
        }
      }, 300000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
