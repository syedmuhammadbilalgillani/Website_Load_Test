"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Globe, Users, AlertTriangle, Loader2, Play } from "lucide-react";

export default function NewTestPage() {
  const [domain, setDomain] = useState("");
  const [users, setUsers] = useState(10);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain: domain.trim(),
          users: Number(users) || 10,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create test");
      router.push(`/dashboard/tests/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create test");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-10">
      <div className="space-y-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          New load test
        </h1>
        <p className="text-sm text-zinc-500">
          Enter domain and number of users. Test runs automatically (GET, 30s).
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
        <p className="text-sm text-amber-200">
          <strong>Ethical use only.</strong> Only test sites you own or have
          permission to test.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        <div className="space-y-2">
          <label
            htmlFor="domain"
            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
          >
            <Globe className="h-4 w-4" />
            Domain
          </label>
          <input
            id="domain"
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            required
            placeholder="example.com or https://example.com"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>
        <div className="space-y-2">
          <label
            htmlFor="users"
            className="flex items-center gap-2 text-sm font-medium text-zinc-300"
          >
            <Users className="h-4 w-4" />
            Users
          </label>
          <input
            id="users"
            type="number"
            min={1}
            max={10000}
            value={users}
            onChange={(e) => setUsers(parseInt(e.target.value, 10) || 1)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-zinc-100 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
          <p className="text-xs text-zinc-500">
            Concurrent virtual users (1–10,000)
          </p>
        </div>
        <div className="flex flex-wrap gap-4 pt-2">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-medium text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            {loading ? "Starting…" : "Start test"}
          </button>
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-zinc-600 px-6 py-3 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
