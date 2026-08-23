import type { DateRange } from "@/modules/finance/dateRanges";
import { generateIntelligenceReport } from "@/modules/intelligence/engine";
import { buildAiContext } from "./context";
import { getAiProvider } from "./registry";
import { buildStartPlan } from "./start";
import type { AiSynthesisResult } from "./types";

/**
 * AI SYNTHESIS ORCHESTRATOR (Phase 5)
 * ---------------------------------------------------------------------------
 * The only function API routes / pages should call for Phase 5. Mirrors
 * generateIntelligenceReport's role in Phase 4: a single entry point
 * that wires the full pipeline together -
 *
 *   Phase 4 Findings -> AI Context -> AI Provider -> Structured
 *   Synthesis -> START Action Plan -> (returned to caller for UI)
 *
 * Nothing is persisted here, for the same reason Phase 4 findings
 * aren't persisted (see modules/intelligence/types.ts): calling this
 * twice with the same inputs always recomputes fresh from the current
 * Phase 1-3 transaction data, so it can never drift out of sync with it.
 *
 * businessId must already be ownership-verified by the caller (e.g. via
 * requireActiveBusinessForApi / requireBusinessContext) - this function
 * does not re-check ownership itself, exactly like
 * generateIntelligenceReport before it.
 */
export async function generateAiSynthesis(
  businessId: string,
  period: DateRange
): Promise<AiSynthesisResult> {
  const report = await generateIntelligenceReport(businessId, period);
  const context = buildAiContext(report);

  const provider = getAiProvider();
  const output = await provider.generateSynthesis(context);

  const startPlan = buildStartPlan(report.findings) ?? {
    situation: "No findings are available for this period yet.",
    target: "Record enough business activity for an analysis to be generated.",
    action: "Begin entering sales, expenses, and other transactions as they happen.",
    review: "Re-run this analysis once activity has been recorded.",
    track: ["Sale Count", "Revenue"],
    sourceFinding: { id: "none", category: "activity", severity: "neutral", title: "No findings available" },
  };

  return {
    businessId: report.businessId,
    period: report.period,
    comparisonPeriod: report.comparisonPeriod,
    generatedAt: new Date().toISOString(),
    provider: provider.name,
    summary: output.summary,
    primaryConcern: output.primaryConcern,
    secondaryConcerns: output.secondaryConcerns,
    positiveSignals: output.positiveSignals,
    recommendedFocus: output.recommendedFocus,
    prioritizedFindings: output.prioritizedFindings,
    startPlan,
    insufficientData: output.insufficientData,
    comparisonAvailable: output.comparisonAvailable,
    comparisonStatus: output.comparisonStatus,
    comparisonLimitation: output.comparisonLimitation,
  };
}
