/**
 * PHASE 5 — AI SYNTHESIS LAYER: SHARED TYPES
 * ---------------------------------------------------------------------------
 * Architecture: Phase 4 Findings -> AI Context -> AI Provider ->
 * Structured Synthesis -> START Action Plan -> UI.
 *
 * Nothing here is a database table (see modules/intelligence/types.ts's
 * note on why Phase 4 findings aren't persisted - the same reasoning
 * applies here: an AI synthesis result is always freshly derived from
 * the current findings, never a stale cached interpretation).
 *
 * These types are deliberately UI-agnostic (no colors, no component
 * props) so any consumer - the current server-rendered page, a future
 * API client, or a future real AI provider - can produce or consume
 * them the same way.
 * ------------------------------------------------------------------------ */

import type { Finding, FindingSeverity } from "@/modules/intelligence/types";
import type { DateRange } from "@/modules/finance/dateRanges";

/** A lightweight reference to a Finding - enough to identify and display it without duplicating the full Finding shape everywhere. */
export type FindingRef = {
  id: string;
  category: Finding["category"];
  severity: FindingSeverity;
  title: string;
};

/**
 * COMPARISON STATUS (Phase 5 fix)
 * ---------------------------------------------------------------------------
 * Mirrors Phase 4's own ComparisonAvailability distinction
 * (modules/intelligence/types.ts) one level up, at the synthesis layer:
 * whether a previous-period comparison is usable is a SEPARATE question
 * from whether the current period has enough data for a synthesis at
 * all. A missing/invalid comparison baseline must never, by itself,
 * mark the whole synthesis as `insufficientData` - see
 * AiSynthesisOutput.insufficientData vs comparisonStatus below.
 *
 * - "available": a previous-period comparison was made (a growth/decline
 *   finding was produced, or the change simply wasn't significant
 *   enough to report).
 * - "no_previous_period_activity": the previous period is a valid
 *   baseline that genuinely had zero sales - a real zero, not missing
 *   data (matches Phase 4's "no_previous_activity").
 * - "zero_baseline": the previous period had sales but zero revenue, so
 *   a percentage change against it isn't meaningful.
 * - "insufficient_data": the business didn't exist for all of the
 *   comparison period, so there is no valid baseline at all yet.
 */
export type ComparisonStatus =
  | "available"
  | "no_previous_period_activity"
  | "zero_baseline"
  | "insufficient_data";

/**
 * The input handed to an AiProvider. This is the ONLY thing a provider
 * ever sees - a provider never touches the database, never receives a
 * raw request, and never receives a client-supplied business id. All of
 * that is resolved server-side (see requireActiveBusinessForApi) before
 * this context is ever built, and the findings inside it are already
 * scoped to a single, ownership-verified business.
 */
export type AiSynthesisContext = {
  businessId: string;
  period: DateRange;
  comparisonPeriod: DateRange | null;
  findings: Finding[];
  counts: Record<FindingSeverity, number>;
};

/**
 * "Structured Synthesis" - what an AiProvider produces. This is the part
 * of the pipeline a real AI provider would eventually replace. It must
 * never contain a fact, number, or cause that isn't already present in
 * the findings passed into it.
 */
export type AiSynthesisOutput = {
  summary: string;
  primaryConcern: FindingRef | null;
  secondaryConcerns: FindingRef[];
  positiveSignals: FindingRef[];
  recommendedFocus: string;
  /** Every finding, in deterministic priority order. */
  prioritizedFindings: FindingRef[];
  /**
   * True ONLY when the current period genuinely lacks enough meaningful
   * business data for a synthesis (Phase 5 fix) - never set merely
   * because a previous-period comparison is unavailable. See
   * comparisonStatus for that separate, current-period-agnostic concern.
   */
  insufficientData: boolean;
  /** Whether a previous-period comparison could be made at all. */
  comparisonAvailable: boolean;
  /** Deterministic classification of why/whether the comparison is available. */
  comparisonStatus: ComparisonStatus;
  /** Human-readable explanation when the comparison is limited, grounded in the relevant finding's own description; null when comparisonStatus is "available". */
  comparisonLimitation: string | null;
};

/**
 * The START Action Framework (Phase 5, Section 4). Always derived from
 * actual findings - never generic motivational advice. This step is
 * deliberately NOT part of the AiProvider interface: it stays
 * deterministic and finding-grounded even after a real AI provider is
 * plugged in later.
 */
export type StartActionPlan = {
  /** S - current business condition, grounded in the source finding. */
  situation: string;
  /** T - the immediate, realistic improvement target. */
  target: string;
  /** A - specific practical action(s) the owner can take. */
  action: string;
  /** R - what should be checked/measured after acting. */
  review: string;
  /** T - which indicators should keep being monitored. */
  track: string[];
  /** The finding this plan was derived from, for traceability. */
  sourceFinding: FindingRef;
};

/** The final, complete Phase 5 output - what the UI (and API) consume. */
export type AiSynthesisResult = {
  businessId: string;
  period: DateRange;
  comparisonPeriod: DateRange | null;
  generatedAt: string;
  /** Which AiProvider produced this ("dummy" for now). */
  provider: string;
  summary: string;
  primaryConcern: FindingRef | null;
  secondaryConcerns: FindingRef[];
  positiveSignals: FindingRef[];
  recommendedFocus: string;
  prioritizedFindings: FindingRef[];
  startPlan: StartActionPlan;
  insufficientData: boolean;
  comparisonAvailable: boolean;
  comparisonStatus: ComparisonStatus;
  comparisonLimitation: string | null;
};
