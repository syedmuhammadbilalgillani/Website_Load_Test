import { Queue, Worker, Job } from "bullmq";

const QUEUE_NAME = "load-test-jobs";

function getConnectionOptions(): { host: string; port: number } {
  const u = process.env.REDIS_URL ?? "redis://localhost:6379";
  try {
    const url = new URL(u);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379", 10),
    };
  } catch {
    return { host: "localhost", port: 6379 };
  }
}

export type LoadTestJobPayload = {
  jobId: string;
  userId: string;
  targetUrl: string;
  method: string;
  concurrency: number;
  durationSeconds: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
};

export function getLoadTestQueue(): Queue {
  return new Queue(QUEUE_NAME, {
    connection: getConnectionOptions(),
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 500 },
      attempts: 1,
    },
  });
}

export function createLoadTestWorker(
  processor: (job: Job<LoadTestJobPayload>) => Promise<void>
): Worker {
  return new Worker(QUEUE_NAME, processor, {
    connection: getConnectionOptions(),
    concurrency: 2,
  });
}
