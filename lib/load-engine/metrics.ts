/**
 * In-memory metrics aggregation for a single load test run.
 * Computes RPS, latencies, error rate, and supports streaming snapshots.
 */

export type RequestSample = {
  latencyMs: number;
  success: boolean;
  statusCode?: number;
  bytes?: number;
};

export type MetricsSnapshot = {
  timestamp: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rps: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number; // 0-100
  throughputBytesPerSec: number;
};

export class MetricsAggregator {
  private samples: RequestSample[] = [];
  private startTime = 0;
  private lastSnapshotTime = 0;
  private lastTotalRequests = 0;

  start(): void {
    this.startTime = Date.now();
    this.lastSnapshotTime = this.startTime;
    this.lastTotalRequests = 0;
    this.samples = [];
  }

  record(sample: RequestSample): void {
    this.samples.push(sample);
  }

  getSnapshot(): MetricsSnapshot {
    const now = Date.now();
    const elapsedSec = Math.max(0.001, (now - this.startTime) / 1000);
    const total = this.samples.length;
    const successful = this.samples.filter((s) => s.success).length;
    const failed = total - successful;
    const latencies = this.samples.map((s) => s.latencyMs).filter((l) => l >= 0);
    latencies.sort((a, b) => a - b);
    const avgLatency =
      latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p95 =
      latencies.length > 0 ? latencies[Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1)] : 0;
    const p99 =
      latencies.length > 0 ? latencies[Math.min(Math.floor(latencies.length * 0.99), latencies.length - 1)] : 0;
    const errorRate = total > 0 ? (failed / total) * 100 : 0;
    const totalBytes = this.samples.reduce((s, n) => s + (n.bytes ?? 0), 0);
    const throughputBytesPerSec = elapsedSec > 0 ? totalBytes / elapsedSec : 0;
    const windowSec = (now - this.lastSnapshotTime) / 1000;
    const rps = windowSec > 0 ? (total - this.lastTotalRequests) / windowSec : total / elapsedSec;

    this.lastSnapshotTime = now;
    this.lastTotalRequests = total;

    return {
      timestamp: now,
      totalRequests: total,
      successfulRequests: successful,
      failedRequests: failed,
      rps: Math.round(rps * 100) / 100,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95),
      p99LatencyMs: Math.round(p99),
      errorRate: Math.round(errorRate * 100) / 100,
      throughputBytesPerSec: Math.round(throughputBytesPerSec),
    };
  }

  getFinalSummary(): MetricsSnapshot {
    return this.getSnapshot();
  }

  getSampleCount(): number {
    return this.samples.length;
  }
}
