"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import type { Business } from "@/db/schema";

export function BusinessSwitcher({
  businesses,
  activeBusinessId,
}: {
  businesses: Business[];
  activeBusinessId: string | null;
}) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectBusiness(businessId: string) {
    setSwitching(businessId);
    setError(null);

    const res = await fetch("/api/business/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ businessId }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Could not switch business.");
      setSwitching(null);
      return;
    }

    router.push("/app/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {businesses.map((b) => {
        const isActive = b.id === activeBusinessId;
        return (
          <div
            key={b.id}
            className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
              isActive ? "border-emerald-300 bg-emerald-50" : "border-slate-200"
            }`}
          >
            <div>
              <p className="text-sm font-medium text-slate-900">
                {b.businessName}
              </p>
              <p className="text-xs text-slate-500">
                {b.businessType ?? "—"} · {b.currency}
              </p>
            </div>
            {isActive ? (
              <span className="text-xs font-medium text-emerald-700">Active</span>
            ) : (
              <Button
                variant="secondary"
                onClick={() => selectBusiness(b.id)}
                disabled={switching === b.id}
              >
                {switching === b.id ? "Switching…" : "Switch"}
              </Button>
            )}
          </div>
        );
      })}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
