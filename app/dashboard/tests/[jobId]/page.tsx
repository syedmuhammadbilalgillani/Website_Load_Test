"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  ArrowLeft,
  Download,
  Globe,
  Zap,
  Clock,
  Activity,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Gauge,
  AlertTriangle,
  BarChart3,
} from "lucide-react";

type Job = {
  id: string;
  status: string;
  targetUrl: string;
  method: string;
  concurrency: number;
  durationSeconds: number;
  errorMessage?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
  result?: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    requestsPerSecondAvg: number;
    responseTimeAvgMs: number;
    responseTimeP95Ms: number | null;
    responseTimeP99Ms: number | null;
    errorRate: number;
    throughputBytesPerSec: number | null;
  } | null;
};

type MetricsSnapshot = {
  timestamp: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rps: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  throughputBytesPerSec: number;
};

export default function TestDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<MetricsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then((p) => setJobId(p.jobId));
  }, [params]);

  const fetchJob = useCallback(() => {
    if (!jobId) return;
    fetch(`/api/jobs/${jobId}`)
      .then((r) => r.json())
      .then(setJob)
      .finally(() => setLoading(false));
  }, [jobId]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    if (!jobId || !job || (job.status !== "queued" && job.status !== "running")) return;
    const es = new EventSource(`/api/jobs/${jobId}/metrics`);
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as MetricsSnapshot;
        setLiveMetrics((prev) => {
          const next = [...prev, { ...data, timestamp: data.timestamp }];
          return next.slice(-120);
        });
      } catch {}
    };
    es.onerror = () => es.close();
    const interval = setInterval(fetchJob, 2000);
    return () => {
      es.close();
      clearInterval(interval);
    };
  }, [jobId, job?.status, fetchJob]);

  if (loading && !job) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <Loader2 className="h-10 w-10 animate-spin text-zinc-400" />
        <p className="text-zinc-400">Loading test…</p>
      </div>
    );
  }
  if (!job) {
    return (
      <div className="space-y-6 py-12">
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="h-5 w-5" />
          Job not found
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-emerald-400 hover:text-emerald-300 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>
    );
  }

  const statusConfig =
    job.status === "completed"
      ? { color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/10" }
      : job.status === "failed" || job.status === "cancelled"
        ? { color: "text-red-400", icon: XCircle, bg: "bg-red-500/10" }
        : { color: "text-amber-400", icon: Loader2, bg: "bg-amber-500/10" };
  const StatusIcon = statusConfig.icon;

  const chartData = liveMetrics.map((m, i) => ({
    index: i,
    time: new Date(m.timestamp).toLocaleTimeString(),
    rps: m.rps,
    latency: m.avgLatencyMs,
    p95: m.p95LatencyMs,
    p99: m.p99LatencyMs,
    errors: m.failedRequests,
    success: m.successfulRequests,
    errorRate: m.errorRate,
    throughput: m.throughputBytesPerSec ? Math.round(m.throughputBytesPerSec / 1024) : 0,
  }));

  const tooltipStyle = {
    backgroundColor: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: "8px",
    padding: "8px 12px",
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 shrink-0 text-zinc-500" />
              <h1
                className="truncate text-xl font-semibold text-zinc-100 sm:max-w-xl"
                title={job.targetUrl}
              >
                {job.targetUrl}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-500">
              <span className="inline-flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                {job.method}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="h-4 w-4" />
                {job.concurrency} users
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {job.durationSeconds}s
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium capitalize ${statusConfig.bg} ${statusConfig.color}`}
              >
                <StatusIcon
                  className={`h-4 w-4 ${job.status === "running" || job.status === "queued" ? "animate-spin" : ""}`}
                />
                {job.status}
              </span>
            </div>
            {job.errorMessage && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {job.errorMessage}
              </div>
            )}
          </div>
          {job.result && (
            <a
              href={`/api/results/${job.id}/report`}
              download
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-600 bg-zinc-800/50 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
            >
              <Download className="h-4 w-4" />
              Download report
            </a>
          )}
        </div>
      </div>

      {(job.status === "running" || job.status === "queued") && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" />
          <p className="text-sm text-amber-200">
            Test in progress. Metrics update in real time. Ensure the worker is
            running (<code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs">npm run worker</code>).
          </p>
        </div>
      )}

      {/* Live metrics charts */}
      {chartData.length > 0 && (
        <div className="space-y-8">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            Live metrics
          </h2>
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                Requests per second
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#71717a" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
                    <Area
                      type="monotone"
                      dataKey="rps"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.2}
                      name="RPS"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                <Gauge className="h-4 w-4 text-amber-400" />
                Latency (ms)
              </p>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#71717a" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
                    <Legend />
                    <Line type="monotone" dataKey="latency" stroke="#f59e0b" name="Avg" dot={false} strokeWidth={2} />
                    <Line type="monotone" dataKey="p95" stroke="#ef4444" name="P95" dot={false} strokeDasharray="4 4" />
                    <Line type="monotone" dataKey="p99" stroke="#ec4899" name="P99" dot={false} strokeDasharray="2 2" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 lg:col-span-2">
              <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                <Activity className="h-4 w-4 text-zinc-500" />
                Success vs failed requests (over time)
              </p>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#71717a" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#71717a" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} />
                    <Legend />
                    <Bar dataKey="success" fill="#10b981" name="Success" stackId="a" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="errors" fill="#ef4444" name="Failed" stackId="a" radius={[0, 0, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6 lg:col-span-2">
              <p className="mb-4 flex items-center gap-2 text-sm font-medium text-zinc-400">
                <AlertCircle className="h-4 w-4 text-red-400" />
                Error rate (%)
              </p>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#3f3f46" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="#71717a" />
                    <YAxis tick={{ fontSize: 10 }} stroke="#71717a" unit="%" />
                    <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#a1a1aa" }} formatter={(value: number) => [`${Number(value).toFixed(2)}%`, "Error rate"]} />
                    <Area
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#ef4444"
                      fill="#ef4444"
                      fillOpacity={0.2}
                      name="Error rate %"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary */}
      {job.result && (
        <div className="space-y-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
            <BarChart3 className="h-5 w-5 text-emerald-400" />
            Summary
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Activity className="h-3.5 w-3.5" />
                Total requests
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {job.result.totalRequests.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                Successful
              </p>
              <p className="mt-2 text-2xl font-semibold text-emerald-400">
                {job.result.successfulRequests.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <XCircle className="h-3.5 w-3.5 text-red-400" />
                Failed
              </p>
              <p className="mt-2 text-2xl font-semibold text-red-400">
                {job.result.failedRequests.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <TrendingUp className="h-3.5 w-3.5" />
                RPS (avg)
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {job.result.requestsPerSecondAvg}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Gauge className="h-3.5 w-3.5" />
                Avg latency
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {job.result.responseTimeAvgMs} <span className="text-sm font-normal text-zinc-500">ms</span>
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Gauge className="h-3.5 w-3.5" />
                P95 latency
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {job.result.responseTimeP95Ms ?? "—"}{" "}
                <span className="text-sm font-normal text-zinc-500">ms</span>
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Gauge className="h-3.5 w-3.5" />
                P99 latency
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {job.result.responseTimeP99Ms ?? "—"}{" "}
                <span className="text-sm font-normal text-zinc-500">ms</span>
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <AlertCircle className="h-3.5 w-3.5" />
                Error rate
              </p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">
                {(job.result.errorRate / 100).toFixed(2)}%
              </p>
            </div>
            {job.result.throughputBytesPerSec != null && job.result.throughputBytesPerSec > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-6">
                <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Throughput
                </p>
                <p className="mt-2 text-2xl font-semibold text-zinc-100">
                  {(job.result.throughputBytesPerSec / 1024).toFixed(1)}{" "}
                  <span className="text-sm font-normal text-zinc-500">KB/s</span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
