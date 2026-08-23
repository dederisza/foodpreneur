"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function Topbar({
  businessName,
  userDisplayName,
}: {
  businessName: string;
  userDisplayName: string;
}) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">
          Active business
        </p>
        <p className="text-sm font-semibold text-slate-900">{businessName}</p>
      </div>

      <div className="flex items-center gap-4">
        <span className="text-sm text-slate-500">{userDisplayName}</span>
        <Button variant="ghost" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? "Logging out…" : "Log out"}
        </Button>
      </div>
    </header>
  );
}
