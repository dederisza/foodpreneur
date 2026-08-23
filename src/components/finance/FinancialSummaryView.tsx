"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { FinancialSummary } from "@/modules/finance/summary";
import { formatCurrency, todayDateInputValue } from "@/lib/format";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

export function FinancialSummaryView({
  initialSummary,
  currency,
}: {
  initialSummary: FinancialSummary;
  currency: string;
}) {
  const [preset, setPreset] = useState<Preset>("month");
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState(todayDateInputValue());
  const [customTo, setCustomTo] = useState(todayDateInputValue());

  // Fetched directly from the button handler rather than via useEffect —
  // this is a user-triggered event, not "synchronizing with an external
  // system" on render, so an effect isn't the right tool here (and
  // calling setState synchronously inside an effect body is flagged by
  // the react-hooks lint rule for good reason: it causes an extra
  // render pass on every mount).
  async function fetchSummary(params: URLSearchParams) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/finance/summary?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load financial summary.");
        return;
      }
      setSummary(data.summary);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function selectPreset(value: Preset) {
    setPreset(value);
    if (value === "custom") {
      // Wait for the person to pick dates and press Apply — fetching
      // immediately would use today's date twice, which isn't useful.
      return;
    }
    await fetchSummary(new URLSearchParams({ preset: value }));
  }

  async function applyCustomRange(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setError("Please choose both a start and end date.");
      return;
    }
    // Client-side check for immediate feedback — the API independently
    // enforces this too (modules/finance/dateRanges.ts), so a manipulated
    // request still can't bypass it.
    if (customFrom > customTo) {
      setError("Start date must not be after end date.");
      return;
    }
    await fetchSummary(
      new URLSearchParams({ preset: "custom", from: customFrom, to: customTo })
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">Financial Summary</h1>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.value}
              variant={preset === p.value ? "primary" : "secondary"}
              onClick={() => selectPreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>
      </div>

      {preset === "custom" && (
        <Card>
          <form
            onSubmit={applyCustomRange}
            className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <div>
              <Label htmlFor="customFrom">From</Label>
              <Input
                id="customFrom"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="customTo">To</Label>
              <Input
                id="customTo"
                type="date"
                value={customTo}
                min={customFrom}
                onChange={(e) => setCustomTo(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? "Applying…" : "Apply"}
            </Button>
          </form>
        </Card>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {loading && preset !== "custom" && (
        <p className="text-sm text-slate-400">Updating…</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-xs uppercase text-slate-400">Revenue</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(summary.revenue, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-400">from {summary.saleCount} sale(s)</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">COGS (HPP)</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(summary.cogs, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Gross Profit</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(summary.grossProfit, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Revenue − COGS</p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Operating Expenses</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(summary.operatingExpenses, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Operating Result</p>
          <p className="mt-2 text-xl font-semibold text-slate-900">
            {formatCurrency(summary.operatingResult, currency)}
          </p>
          <p className="mt-1 text-xs text-slate-400">Gross Profit − Operating Expenses</p>
        </Card>
      </div>

      <Card className="border-dashed">
        <p className="text-sm text-slate-500">
          Capital and Owner Drawings are cash movements, not part of profit —
          shown separately, never mixed into Revenue or Operating Expenses.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-400">Capital (this period)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(summary.capital, currency)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-400">Owner Drawings (this period)</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">
              {formatCurrency(summary.ownerDrawings, currency)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
