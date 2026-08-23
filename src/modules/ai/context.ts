import type { IntelligenceReport } from "@/modules/intelligence/types";
import type { AiSynthesisContext } from "./types";

/**
 * AI CONTEXT BUILDER (Phase 5, "Phase 4 Findings -> AI Context")
 * ---------------------------------------------------------------------------
 * This is the ONLY bridge between Phase 4 and the AI layer. Phase 4
 * findings pass through completely unmodified - nothing is
 * recalculated, reinterpreted, filtered, or dropped here. This keeps
 * Phase 4 as the sole deterministic source of business facts (Phase 5,
 * Section 6) and Phase 5 as strictly a consumer/synthesizer of it.
 * ------------------------------------------------------------------------ */
export function buildAiContext(report: IntelligenceReport): AiSynthesisContext {
  return {
    businessId: report.businessId,
    period: report.period,
    comparisonPeriod: report.comparisonPeriod,
    findings: report.findings,
    counts: report.counts,
  };
}
