"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Loader2,
  ExternalLink,
  Globe,
  Zap,
  Clock,
  Activity,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

type Job = {
  id: string;
  status: string;
  targetUrl: string;
  method: string;
  concurrency: number;
  durationSeconds: number;
  createdAt: string;
  result?: {
    totalRequests: number;
    requestsPerSecondAvg: number;
    responseTimeAvgMs: number;
    errorRate: number;
  } | null;
};

export default function DashboardPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs?page=1&pageSize=20")
      .then((r) => r.json())
      .then((data) => {
        if (data.jobs) {
          setJobs(data.jobs);
          setTotal(data.total ?? 0);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const statusConfig = (s: string) => {
    switch (s) {
      case "completed":
        return { color: "text-emerald-400", icon: CheckCircle2, bg: "bg-emerald-500/10" };
      case "running":
      case "queued":
        return { color: "text-amber-400", icon: Loader2, bg: "bg-amber-500/10" };
      case "failed":
      case "cancelled":
        return { color: "text-red-400", icon: XCircle, bg: "bg-red-500/10" };
      default:
        return { color: "text-zinc-400", icon: AlertCircle, bg: "bg-zinc-500/10" };
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
            Load tests
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            View and manage your load test runs
          </p>
        </div>
        <Link
          href="/dashboard/tests/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500"
        >
          <PlusCircle className="h-4 w-4" />
          New test
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/30 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
          <p className="text-zinc-400">Loading tests…</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-16 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
            <Activity className="h-7 w-7 text-zinc-500" />
          </div>
          <p className="text-lg font-medium text-zinc-300">No load tests yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            Create your first test to measure performance and throughput.
          </p>
          <Link
            href="/dashboard/tests/new"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            <PlusCircle className="h-4 w-4" />
            Create your first test
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left py-4 px-6 font-medium text-zinc-400">Target</th>
                  <th className="text-left py-4 px-6 font-medium text-zinc-400">Method</th>
                  <th className="text-left py-4 px-6 font-medium text-zinc-400">Users</th>
                  <th className="text-left py-4 px-6 font-medium text-zinc-400">Duration</th>
                  <th className="text-left py-4 px-6 font-medium text-zinc-400">Status</th>
                  <th className="text-left py-4 px-6 font-medium text-zinc-400">Results</th>
                  <th className="text-left py-4 px-6 font-medium text-zinc-400"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const status = statusConfig(job.status);
                  const StatusIcon = status.icon;
                  return (
                    <tr
                      key={job.id}
                      className="border-b border-zinc-800/60 transition hover:bg-zinc-800/20"
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 shrink-0 text-zinc-500" />
                          <span
                            className="max-w-[220px] truncate text-zinc-300"
                            title={job.targetUrl}
                          >
                            {job.targetUrl}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6 text-zinc-400">{job.method}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                          <Zap className="h-3.5 w-3.5" />
                          {job.concurrency}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center gap-1.5 text-zinc-400">
                          <Clock className="h-3.5 w-3.5" />
                          {job.durationSeconds}s
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium capitalize ${status.bg} ${status.color}`}
                        >
                          <StatusIcon
                            className={`h-3.5 w-3.5 ${job.status === "running" || job.status === "queued" ? "animate-spin" : ""}`}
                          />
                          {job.status}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-zinc-400">
                        {job.result ? (
                          <span className="flex flex-wrap gap-x-3 gap-y-0 text-xs">
                            <span>{job.result.totalRequests} req</span>
                            <span>{job.result.requestsPerSecondAvg} rps</span>
                            <span>{job.result.responseTimeAvgMs}ms</span>
                            <span className="text-red-400/90">
                              {(job.result.errorRate / 100).toFixed(2)}% err
                            </span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <Link
                          href={`/dashboard/tests/${job.id}`}
                          className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition"
                        >
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {total > 20 && (
        <p className="text-center text-sm text-zinc-500">
          Showing latest 20 of {total} tests
        </p>
      )}
    </div>
  );
}
