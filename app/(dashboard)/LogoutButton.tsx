"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800/80 hover:text-zinc-200 transition"
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </button>
  );
}
