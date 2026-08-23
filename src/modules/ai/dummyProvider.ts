import type { Finding } from "@/modules/intelligence/types";
import type { AiProvider } from "./provider";
import type { AiSynthesisContext, AiSynthesisOutput, ComparisonStatus } from "./types";
import { prioritizeFindings, toFindingRef } from "./priority";

const MAX_SECONDARY_CONCERNS = 3;
const MAX_POSITIVE_SIGNALS = 3;

const CONCERN_SEVERITIES = new Set(["critical", "warning"]);
const MEANINGFUL_SEVERITIES = new Set(["critical", "warning", "positive", "opportunity"]);

/**
 * Finding id (from modules/intelligence/rules.ts) that represents "there
 * is no business activity at all yet" - the ONLY marker that can
 * contribute to the overall `insufficientData` flag. This is
 * deliberately narrower than the set of comparison-related finding ids
 * below (Phase 5 fix): a missing/invalid previous-period baseline is a
 * comparison-only limitation, never a reason to call the whole
 * synthesis insufficient when the current period has real findings.
 */
const OVERALL_NO_DATA_FINDING_ID = "activity-no-transactions-ever";

/**
 * COMPARISON STATUS DERIVATION (Phase 5 fix)
 * ---------------------------------------------------------------------------
 * Phase 4's rules.ts always produces at most one of these finding ids
 * to describe the previous-period comparison outcome (see
 * evaluateSalesFindings' comparison branch). Deriving comparisonStatus
 * from whichever one is present - rather than folding any of them into
 * `insufficientData` - is what lets the current period be synthesized
 * normally while still surfacing the comparison limitation separately.
 */
function deriveComparisonStatus(findings: Finding[]): {
  status: ComparisonStatus;
  available: boolean;
  limitation: string | null;
} {
  const insufficient = findings.find((f) => f.id === "sales-comparison-insufficient-data");
  if (insufficient) {
    return { status: "insufficient_data", available: false, limitation: insufficient.description };
  }
  const noPreviousActivity = findings.find((f) => f.id === "sales-comparison-no-previous-activity");
  if (noPreviousActivity) {
    return { status: "no_previous_period_activity", available: true, limitation: noPreviousActivity.description };
  }
  const zeroBaseline = findings.find((f) => f.id === "sales-comparison-zero-baseline");
  if (zeroBaseline) {
    return { status: "zero_baseline", available: true, limitation: zeroBaseline.description };
  }
  return { status: "available", available: true, limitation: null };
}

const IRREGULAR_PLURALS: Record<string, string> = {
  opportunity: "opportunities",
};

function pluralize(n: number, word: string): string {
  if (n === 1) return `1 ${word}`;
  return `${n} ${IRREGULAR_PLURALS[word] ?? `${word}s`}`;
}

function buildSummary(params: {
  ordered: Finding[];
  counts: AiSynthesisContext["counts"];
  primary: Finding | null;
  positives: Finding[];
  isInsufficientData: boolean;
  comparisonLimitation: string | null;
}): string {
  const { ordered, counts, primary, positives, isInsufficientData, comparisonLimitation } = params;

  if (isInsufficientData) {
    const dataFinding = ordered.find((f) => f.id === OVERALL_NO_DATA_FINDING_ID);
    return dataFinding
      ? `${dataFinding.description} No further business interpretation can be produced until more activity is recorded.`
      : "There is not enough recorded business activity yet for an interpretation.";
  }

  const parts: string[] = [];
  parts.push(
    `This period has ${pluralize(counts.critical, "critical issue")} and ` +
      `${pluralize(counts.warning, "warning")}, alongside ` +
      `${pluralize(counts.positive, "positive signal")} and ` +
      `${pluralize(counts.opportunity, "opportunity")}.`
  );

  if (primary) {
    parts.push(`The most pressing issue is "${primary.title}": ${primary.description}`);
  } else if (positives.length > 0) {
    parts.push(
      `No critical or warning issues were found this period. The strongest positive signal is "${positives[0].title}".`
    );
  } else {
    parts.push("No critical, warning, or positive findings stood out this period.");
  }

  // Surface the comparison limitation as a factual aside, never as a
  // growth/decline claim - the sentence only ever repeats the grounded
  // finding description already produced by Phase 4.
  if (comparisonLimitation) {
    parts.push(comparisonLimitation);
  }

  return parts.join(" ");
}

function buildRecommendedFocus(
  primary: Finding | null,
  positives: Finding[],
  isInsufficientData: boolean
): string {
  if (isInsufficientData) {
    return "Keep recording sales and expenses consistently so future analyses have a reliable baseline.";
  }
  if (primary) {
    switch (primary.category) {
      case "profitability":
        return "Focus on restoring healthy profitability before pursuing growth.";
      case "expenses":
        return "Focus on bringing operating expenses back in line with gross profit.";
      case "sales":
        return "Focus on rebuilding sales volume and revenue.";
      case "activity":
        return "Focus on resuming consistent day-to-day business activity and record-keeping.";
    }
  }
  if (positives.length > 0) {
    return "Maintain current performance and look for opportunities to build on what is already working.";
  }
  return "Continue monitoring the business; no single area stands out as the priority right now.";
}

/**
 * DUMMY AI PROVIDER (Phase 5, Section 1-2)
 * ---------------------------------------------------------------------------
 * A deterministic stand-in for a real AI provider. It does not call any
 * external model, API, or SDK - it interprets Phase 4 findings using
 * fixed, explainable rules (priority ordering + templated text keyed to
 * a finding's own title/description/metrics), so the same set of
 * findings always produces the same synthesis.
 *
 * Its purpose (per the Phase 5 spec) is not to pretend to be a real
 * LLM - it exists to validate the full Phase 5 architecture end-to-end
 * (context -> provider -> structured synthesis) before a real provider
 * is ever plugged in behind this same AiProvider interface.
 *
 * Every sentence produced here is built from a finding's own fields or
 * from the severity counts already computed by Phase 4 - nothing here
 * fabricates a number, a cause, or a fact that isn't already present in
 * the findings it was given.
 */
export class DummyAiProvider implements AiProvider {
  readonly name = "dummy";

  async generateSynthesis(context: AiSynthesisContext): Promise<AiSynthesisOutput> {
    const { findings, counts } = context;

    if (findings.length === 0) {
      return {
        summary:
          "No findings are available for this period, so there is not enough data yet for a business interpretation.",
        primaryConcern: null,
        secondaryConcerns: [],
        positiveSignals: [],
        recommendedFocus: "Record sales, expense, and other business activity so an analysis can be generated.",
        prioritizedFindings: [],
        insufficientData: true,
        comparisonAvailable: false,
        comparisonStatus: "insufficient_data",
        comparisonLimitation: null,
      };
    }

    const ordered = prioritizeFindings(findings);
    const comparison = deriveComparisonStatus(findings);

    // OVERALL INSUFFICIENT DATA (Phase 5 fix)
    // ---------------------------------------------------------------
    // True ONLY when the current period itself has no meaningful signal
    // to synthesize - no critical/warning concern, no positive signal,
    // no opportunity - AND the explicit "no transactions at all yet"
    // marker is present. A comparison-only limitation
    // (sales-comparison-insufficient-data) never contributes to this by
    // itself: the current period can still contain perfectly valid
    // findings (positive profitability, a best-performing product,
    // active status, etc.) even when there's no valid previous period
    // to compare against yet.
    const hasMeaningfulSignal = findings.some((f) => MEANINGFUL_SEVERITIES.has(f.severity));
    const hasOverallNoDataMarker = findings.some((f) => f.id === OVERALL_NO_DATA_FINDING_ID);
    const isInsufficientData = !hasMeaningfulSignal && hasOverallNoDataMarker;

    const concerns = ordered.filter((f) => CONCERN_SEVERITIES.has(f.severity));
    const positives = ordered.filter((f) => f.severity === "positive");

    const primary = concerns[0] ?? null;
    const secondary = concerns.slice(1, 1 + MAX_SECONDARY_CONCERNS);
    const positiveSignals = positives.slice(0, MAX_POSITIVE_SIGNALS);

    return {
      summary: buildSummary({
        ordered,
        counts,
        primary,
        positives: positiveSignals,
        isInsufficientData,
        comparisonLimitation: isInsufficientData ? null : comparison.limitation,
      }),
      primaryConcern: primary ? toFindingRef(primary) : null,
      secondaryConcerns: secondary.map(toFindingRef),
      positiveSignals: positiveSignals.map(toFindingRef),
      recommendedFocus: buildRecommendedFocus(primary, positiveSignals, isInsufficientData),
      prioritizedFindings: ordered.map(toFindingRef),
      insufficientData: isInsufficientData,
      comparisonAvailable: comparison.available,
      comparisonStatus: comparison.status,
      comparisonLimitation: comparison.limitation,
    };
  }
}
