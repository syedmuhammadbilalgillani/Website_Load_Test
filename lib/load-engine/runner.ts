import { MetricsAggregator, type MetricsSnapshot } from "./metrics";
import { fetchWithMetrics } from "./http-client";

export type RunLoadTestOptions = {
  targetUrl: string;
  method: string;
  concurrency: number;
  durationSeconds: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  onMetrics?: (snapshot: MetricsSnapshot) => void;
  metricsIntervalMs?: number;
};

/**
 * Run a load test: spawn N concurrent virtual users, each sending requests in a loop
 * until duration is reached. Aggregates metrics and optionally streams them.
 */
export async function runLoadTest(options: RunLoadTestOptions): Promise<MetricsSnapshot> {
  const {
    targetUrl,
    method,
    concurrency,
    durationSeconds,
    requestHeaders,
    requestBody,
    onMetrics,
    metricsIntervalMs = 1000,
  } = options;

  const aggregator = new MetricsAggregator();
  aggregator.start();

  const endTime = Date.now() + durationSeconds * 1000;
  let metricsTimer: ReturnType<typeof setInterval> | null = null;

  if (onMetrics) {
    metricsTimer = setInterval(() => {
      onMetrics(aggregator.getSnapshot());
    }, metricsIntervalMs);
  }

  const runOneUser = async (): Promise<void> => {
    while (Date.now() < endTime) {
      const result = await fetchWithMetrics(targetUrl, method, {
        headers: requestHeaders,
        body: requestBody,
      });
      aggregator.record({
        latencyMs: result.latencyMs,
        success: result.success,
        statusCode: result.statusCode,
        bytes: result.bytes,
      });
    }
  };

  const workers = Array.from({ length: concurrency }, () => runOneUser());
  await Promise.all(workers);

  if (metricsTimer) clearInterval(metricsTimer);

  const final = aggregator.getFinalSummary();
  if (onMetrics) onMetrics(final);
  return final;
}
