"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import type { AiSynthesisResult, FindingRef } from "@/modules/ai/types";
import { formatDate, todayDateInputValue } from "@/lib/format";
import { SEVERITY_BADGE_CLASSES } from "@/lib/severity";

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
      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium capitalize ${SEVERITY_BADGE_CLASSES[finding.severity]}`}>
        {finding.severity}
      </span>
      <span className="text-sm text-slate-700">{finding.title}</span>
    </div>
  );
}

export function AiStrategyView({ initialResult }: { initialResult: AiSynthesisResult }) {
  const [preset, setPreset] = useState<Preset>("month");
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customFrom, setCustomFrom] = useState(todayDateInputValue());
  const [customTo, setCustomTo] = useState(todayDateInputValue());

  async function fetchResult(params: URLSearchParams) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/ai/synthesis?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to load business guidance.");
        return;
      }
      setResult(data.result);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function selectPreset(value: Preset) {
    setPreset(value);
    if (value === "custom") return;
    await fetchResult(new URLSearchParams({ preset: value }));
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
    await fetchResult(new URLSearchParams({ preset: "custom", from: customFrom, to: customTo }));
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Strategy &amp; Business Guidance</h1>
          <p className="mt-1 text-sm text-slate-500">
            An AI-style interpretation of your Business Intelligence findings, plus a
            START action plan. Every number here comes directly from your own
            records — this uses a deterministic demo synthesis provider, not a
            live AI model.
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
              <Label htmlFor="aiFrom">From</Label>
              <Input
                id="aiFrom"
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(e) => setCustomFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="aiTo">To</Label>
              <Input
                id="aiTo"
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
      {loading && preset !== "custom" && <p className="text-sm text-slate-400">Synthesizing…</p>}

      <Card>
        <p className="text-xs uppercase text-slate-400">
          Period: {formatDate(result.period.from)} - {formatDate(result.period.to)}
          {result.comparisonPeriod && (
            <> · compared with {formatDate(result.comparisonPeriod.from)} - {formatDate(result.comparisonPeriod.to)}</>
          )}
        </p>
        <p className="mt-3 text-sm text-slate-700">{result.summary}</p>
        {result.insufficientData && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            Not enough historical data yet for a deeper interpretation.
          </p>
        )}
        {!result.insufficientData && !result.comparisonAvailable && result.comparisonLimitation && (
          <p className="mt-2 text-xs font-medium text-slate-500">
            Comparison note: {result.comparisonLimitation}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Primary Concern</h2>
          {result.primaryConcern ? (
            <div className="mt-3">
              <FindingBadge finding={result.primaryConcern} />
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No critical or warning issues detected this period.</p>
          )}

          {result.secondaryConcerns.length > 0 && (
            <>
              <h3 className="mt-4 text-xs font-semibold uppercase text-slate-400">Secondary Concerns</h3>
              <div className="mt-2 space-y-2">
                {result.secondaryConcerns.map((f) => (
                  <FindingBadge key={f.id} finding={f} />
                ))}
              </div>
            </>
          )}
        </Card>

        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Positive Signals</h2>
          {result.positiveSignals.length > 0 ? (
            <div className="mt-3 space-y-2">
              {result.positiveSignals.map((f) => (
                <FindingBadge key={f.id} finding={f} />
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No standout positive signals this period.</p>
          )}

          <h3 className="mt-4 text-xs font-semibold uppercase text-slate-400">Recommended Focus</h3>
          <p className="mt-2 text-sm text-slate-700">{result.recommendedFocus}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">START Action Plan</h2>
        <p className="mt-1 text-xs text-slate-400">
          Derived from: {result.startPlan.sourceFinding.title}
        </p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">S · Situation</h3>
            <p className="mt-1 text-sm text-slate-700">{result.startPlan.situation}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">T · Target</h3>
            <p className="mt-1 text-sm text-slate-700">{result.startPlan.target}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">A · Action</h3>
            <p className="mt-1 text-sm text-slate-700">{result.startPlan.action}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">R · Review</h3>
            <p className="mt-1 text-sm text-slate-700">{result.startPlan.review}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
            <h3 className="text-xs font-semibold uppercase text-emerald-700">T · Track</h3>
            <p className="mt-1 text-sm text-slate-700">{result.startPlan.track.join(", ")}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
