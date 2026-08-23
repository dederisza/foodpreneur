import type { FindingSeverity } from "@/modules/intelligence/types";

/** Canonical display order everywhere severities are listed (matches Phase 5's own priority ordering). */
export const SEVERITY_ORDER: FindingSeverity[] = [
  "critical",
  "warning",
  "opportunity",
  "positive",
  "neutral",
];

export const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  critical: "Critical",
  warning: "Warnings",
  opportunity: "Opportunities",
  positive: "Positive Signals",
  neutral: "Neutral / Informational",
};

export const SEVERITY_CARD_CLASSES: Record<FindingSeverity, string> = {
  critical: "border-red-200 bg-red-50",
  warning: "border-amber-200 bg-amber-50",
  opportunity: "border-blue-200 bg-blue-50",
  positive: "border-emerald-200 bg-emerald-50",
  neutral: "border-slate-200 bg-slate-50",
};

export const SEVERITY_BADGE_CLASSES: Record<FindingSeverity, string> = {
  critical: "bg-red-100 text-red-700",
  warning: "bg-amber-100 text-amber-700",
  opportunity: "bg-blue-100 text-blue-700",
  positive: "bg-emerald-100 text-emerald-700",
  neutral: "bg-slate-200 text-slate-600",
};
