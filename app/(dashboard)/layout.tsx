import Link from "next/link";
import { LayoutDashboard, PlusCircle } from "lucide-react";
import { LogoutButton } from "./LogoutButton";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 font-semibold text-lg text-zinc-100 hover:text-white transition"
          >
            <div className="rounded-lg bg-emerald-600/20 p-2">
              <LayoutDashboard className="h-5 w-5 text-emerald-400" />
            </div>
            Load Test SaaS
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 transition"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/tests/new"
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 transition"
            >
              <PlusCircle className="h-4 w-4" />
              New test
            </Link>
            <LogoutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
    </div>
  );
}
