/**
 * PHASE 4 — INTELLIGENCE ENGINE OUTPUT MODEL
 * ---------------------------------------------------------------------------
 * This is deliberately NOT a database table. Findings are calculated
 * dynamically, on request, from existing Phase 1-3 data — there is no
 * new "business_diagnostics" table and nothing here is persisted. This
 * keeps the engine simple and impossible to get out of sync with the
 * underlying transaction data: a finding is always freshly derived,
 * never a stale snapshot of a past calculation.
 *
 * Every finding is fully explainable: `metrics` carries the actual
 * numbers that produced it, so nothing here is a black box.
 * ------------------------------------------------------------------------ */

export type FindingCategory = "sales" | "profitability" | "expenses" | "activity";

export type FindingSeverity = "critical" | "warning" | "opportunity" | "positive" | "neutral";

/**
 * COMPARISON AVAILABILITY (Phase 4 fix)
 * ---------------------------------------------------------------------------
 * Three genuinely distinct conditions, previously collapsed into a single
 * hard-coded `true`:
 *   - "available": the previous period existed for the whole business's
 *     lifetime and had at least one sale — a growth/decline percentage
 *     is meaningful.
 *   - "no_previous_activity": the previous period fully occurred after
 *     the business was created, but genuinely had zero sales. This is a
 *     valid zero, not missing data — must never be reported as
 *     "insufficient data".
 *   - "insufficient_data": the business did not exist for all or part of
 *     the previous period, so there is no valid baseline to compare
 *     against at all, regardless of whether any sales happened to be
 *     recorded in it.
 * ------------------------------------------------------------------------ */
export type ComparisonAvailability = "available" | "no_previous_activity" | "insufficient_data";

export type Finding = {
  /** Deterministic slug (not a DB id, since findings aren't persisted) — stable across calls for the same condition, e.g. "sales-no-activity". */
  id: string;
  businessId: string;
  category: FindingCategory;
  severity: FindingSeverity;
  title: string;
  description: string;
  /** The actual numbers behind this finding — what makes it explainable rather than a generic statement. */
  metrics: Record<string, number | string | null>;
  period: { from: string; to: string };
  evaluatedAt: string;
};

export type IntelligenceReport = {
  businessId: string;
  period: { from: string; to: string };
  comparisonPeriod: { from: string; to: string } | null;
  findings: Finding[];
  /** Quick counts for the summary banner in the UI. */
  counts: Record<FindingSeverity, number>;
};
