import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold tracking-tight">
          Load Test Your APIs &amp; Sites
        </h1>
        <p className="text-zinc-400 text-lg">
          Production-ready load testing SaaS. Configure concurrency, duration, and
          method—then view real-time metrics and download reports.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/register"
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 px-6 transition"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-lg border border-zinc-600 hover:bg-zinc-800 text-zinc-200 font-medium py-3 px-6 transition"
          >
            Sign in
          </Link>
        </div>
        <div className="mt-12 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-left text-sm text-amber-200">
          <strong>Ethical use only.</strong> Only test sites and APIs you own or have
          permission to test. Internal and private networks are blocked. By using this
          platform you confirm your tests are authorized.
        </div>
      </div>
    </div>
  );
}
