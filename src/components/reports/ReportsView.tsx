"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { BusinessReport } from "@/modules/reports/service";
import type { FindingRef } from "@/modules/ai/types";
import { formatCurrency, formatDate, todayDateInputValue } from "@/lib/format";
import { SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_BADGE_CLASSES } from "@/lib/severity";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

function FindingBadge({ finding }: { finding: FindingRef }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_BADGE_CLASSES[finding.severity]}`}
      >
        {finding.severity}
      </span>
      <span className="text-sm text-slate-700">{finding.title}</span>
    </div>
  );
}

function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: "positive" | "negative" }) {
  const valueClass =
    emphasis === "positive"
      ? "text-emerald-700"
      : emphasis === "negative"
        ? "text-red-700"
        : "text-slate-900";
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className={`text-sm font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

export function ReportsView({
  initialReport,
  currency,
}: {
  initialReport: BusinessReport;
  currency: string;
}) {
  const [preset, setPreset] = useState<Preset>("month");
  const [report, setReport] = useState(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState(todayDateInputValue());
  const [customTo, setCustomTo] = useState(todayDateInputValue());

  async function fetchReport(params: URLSearchParams) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load report.");
        return;
      }
      setReport(data.report);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function selectPreset(value: Preset) {
    setPreset(value);
    if (value === "custom") return;
    await fetchReport(new URLSearchParams({ preset: value }));
  }

  async function applyCustomRange(e: React.FormEvent) {
    e.preventDefault();
    if (!customFrom || !customTo) {
      setError("Please choose both a start and end date.");
      return;
    }
    if (customFrom > customTo) {
      setError("Start date must not be after end date.");
      return;
    }
    await fetchReport(new URLSearchParams({ preset: "custom", from: customFrom, to: customTo }));
  }

  const money = (v: number) => formatCurrency(v, currency);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            A single view of your business summary, sales, intelligence findings, and
            current START action plan for the selected period.
          </p>
        </div>
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
              <Label htmlFor="reportFrom">From</Label>
              <Input
                id="reportFrom"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="reportTo">To</Label>
              <Input
                id="reportTo"
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

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loading && preset !== "custom" && <p className="text-sm text-slate-400">Loading report…</p>}

      <p className="text-xs uppercase text-slate-400">
        Period: {formatDate(report.period.from)} - {formatDate(report.period.to)}
        {report.comparisonPeriod && (
          <> · compared with {formatDate(report.comparisonPeriod.from)} - {formatDate(report.comparisonPeriod.to)}</>
        )}
      </p>

      {/* BUSINESS SUMMARY */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Business Summary</h2>
        <div className="mt-3">
          <Row label="Revenue" value={money(report.business.revenue)} />
          <Row label="COGS / HPP" value={money(report.business.cogs)} />
          <Row label="Gross Profit" value={money(report.business.grossProfit)} emphasis={report.business.grossProfit >= 0 ? "positive" : "negative"} />
          <Row label="Operating Expenses" value={money(report.business.operatingExpenses)} />
          <Row
            label="Operating Result"
            value={money(report.business.operatingResult)}
            emphasis={report.business.operatingResult >= 0 ? "positive" : "negative"}
          />
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Capital and Owner Drawings are shown separately - never counted as revenue or expenses.
        </p>
        <div className="mt-1">
          <Row label="Capital (this period)" value={money(report.business.capital)} />
          <Row label="Owner Drawings (this period)" value={money(report.business.ownerDrawings)} />
        </div>
      </Card>

      {/* SALES SUMMARY */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Sales Summary</h2>
        <div className="mt-3">
          <Row label="Number of sales" value={String(report.sales.saleCount)} />
          <Row label="Sales revenue" value={money(report.sales.revenue)} />
        </div>

        {report.sales.bestPerformingProducts.length > 0 && (
          <>
            <h3 className="mt-4 text-xs font-semibold uppercase text-slate-400">Best-Performing Products</h3>
            <div className="mt-2 space-y-2">
              {report.sales.bestPerformingProducts.map((p) => (
                <div
                  key={p.productId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-sm text-slate-700">{p.productName}</span>
                  <span className="text-xs text-slate-500">
                    {p.quantitySold} unit(s) · {money(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {report.sales.notSoldCount !== null && report.sales.notSoldCount > 0 && (
          <p className="mt-3 text-xs text-slate-500">
            {report.sales.notSoldCount} of {report.sales.activeProductCount} active product(s) had no sales this period.
          </p>
        )}

        {report.sales.saleCount === 0 && (
          <p className="mt-3 text-sm text-slate-500">No sales were recorded in this period.</p>
        )}
      </Card>

      {/* INTELLIGENCE SUMMARY */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Intelligence Summary</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {SEVERITY_ORDER.map((s) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-medium ${SEVERITY_BADGE_CLASSES[s]}`}
            >
              {SEVERITY_LABELS[s]}: {report.intelligence.counts[s]}
            </span>
          ))}
        </div>

        <h3 className="mt-4 text-xs font-semibold uppercase text-slate-400">Primary Concern</h3>
        {report.intelligence.primaryConcern ? (
          <div className="mt-2">
            <FindingBadge finding={report.intelligence.primaryConcern} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No critical or warning issues detected this period.</p>
        )}

        <h3 className="mt-4 text-xs font-semibold uppercase text-slate-400">Recommended Focus</h3>
        <p className="mt-2 text-sm text-slate-700">{report.intelligence.recommendedFocus}</p>
      </Card>

      {/* START SUMMARY */}
      <Card>
        <h2 className="text-sm font-semibold text-slate-900">START Action Plan</h2>
        <p className="mt-1 text-xs text-slate-400">Derived from: {report.startPlan.sourceFinding.title}</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">S · Situation</h3>
            <p className="mt-1 text-sm text-slate-700">{report.startPlan.situation}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">T · Target</h3>
            <p className="mt-1 text-sm text-slate-700">{report.startPlan.target}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">A · Action</h3>
            <p className="mt-1 text-sm text-slate-700">{report.startPlan.action}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">R · Review</h3>
            <p className="mt-1 text-sm text-slate-700">{report.startPlan.review}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">T · Track</h3>
            <p className="mt-1 text-sm text-slate-700">{report.startPlan.track.join(", ")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
