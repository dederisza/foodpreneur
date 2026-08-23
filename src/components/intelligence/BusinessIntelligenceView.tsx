"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { IntelligenceReport } from "@/modules/intelligence/types";
import { formatDate, todayDateInputValue } from "@/lib/format";
import { SEVERITY_ORDER, SEVERITY_LABELS, SEVERITY_CARD_CLASSES, SEVERITY_BADGE_CLASSES } from "@/lib/severity";

const PRESETS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

export function BusinessIntelligenceView({
  initialReport,
}: {
  initialReport: IntelligenceReport;
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
      const res = await fetch(`/api/intelligence?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load business intelligence.");
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

  const grouped = SEVERITY_ORDER.map((severity) => ({
    severity,
    findings: report.findings.filter((f) => f.severity === severity),
  })).filter((g) => g.findings.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Business Intelligence</h1>
          <p className="mt-1 text-sm text-slate-500">
            Deterministic, rule-based findings from your actual sales, cost,
            and expense records - not AI-generated. Every finding shows the
            numbers behind it.
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
              <Label htmlFor="biFrom">From</Label>
              <Input
                id="biFrom"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="biTo">To</Label>
              <Input
                id="biTo"
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
      {loading && preset !== "custom" && <p className="text-sm text-slate-400">Analyzing…</p>}

      <Card>
        <p className="text-xs uppercase text-slate-400">
          Period: {formatDate(report.period.from)} - {formatDate(report.period.to)}
          {report.comparisonPeriod && (
            <> · compared with {formatDate(report.comparisonPeriod.from)} - {formatDate(report.comparisonPeriod.to)}</>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {SEVERITY_ORDER.map((s) => (
            <span
              key={s}
              className={`rounded-full px-3 py-1 text-xs font-medium ${SEVERITY_BADGE_CLASSES[s]}`}
            >
              {SEVERITY_LABELS[s]}: {report.counts[s]}
            </span>
          ))}
        </div>
      </Card>

      {grouped.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No findings for this period.
        </Card>
      ) : (
        grouped.map((group) => (
          <div key={group.severity} className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-900">
              {SEVERITY_LABELS[group.severity]}
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {group.findings.map((finding) => (
                <Card
                  key={finding.id}
                  className={`border ${SEVERITY_CARD_CLASSES[finding.severity]}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">{finding.title}</h3>
                      <p className="mt-1 text-sm text-slate-600">{finding.description}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs font-medium capitalize text-slate-500">
                      {finding.category}
                    </span>
                  </div>
                  {Object.keys(finding.metrics).length > 0 && (
                    <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 border-t border-black/5 pt-3 text-xs">
                      {Object.entries(finding.metrics).map(([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <dt className="text-slate-400">{key}:</dt>
                          <dd className="font-medium text-slate-700">{String(value)}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
