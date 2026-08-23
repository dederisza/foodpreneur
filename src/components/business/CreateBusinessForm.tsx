"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";

const BUSINESS_TYPES = [
  { value: "street_food", label: "Street food / Kaki lima" },
  { value: "fast_food", label: "Fast food" },
  { value: "cafe_small", label: "Small café / warung" },
  { value: "other", label: "Other food business" },
];

export function CreateBusinessForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0].value);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/business", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessName, businessType }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      router.push("/app/dashboard");
      router.refresh();
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="businessName">Business name</Label>
        <Input
          id="businessName"
          required
          value={businessName}
          onChange={(e) => setBusinessName(e.target.value)}
          placeholder="e.g. Warung Nasi Bu Yani"
        />
      </div>

      <div>
        <Label htmlFor="businessType">Business type</Label>
        <select
          id="businessType"
          value={businessType}
          onChange={(e) => setBusinessType(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        >
          {BUSINESS_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Creating…" : "Create my business"}
      </Button>
    </form>
  );
}
