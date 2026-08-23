import type { DateRange } from "@/modules/finance/dateRanges";
import { calculateFinancialSummary } from "@/modules/finance/summary";
import { getSalesMetrics, getActiveProductCount, type ProductSalesMetric } from "@/modules/intelligence/metrics";
import { generateAiSynthesis } from "@/modules/ai/synthesis";
import type { FindingRef, StartActionPlan, ComparisonStatus } from "@/modules/ai/types";
import type { FindingSeverity } from "@/modules/intelligence/types";

export type BusinessReport = {
  businessId: string;
  period: DateRange;
  comparisonPeriod: DateRange | null;
  generatedAt: string;
  aiProvider: string;

  business: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingResult: number;
    capital: number;
    ownerDrawings: number;
  };

  sales: {
    saleCount: number;
    revenue: number;
    bestPerformingProducts: ProductSalesMetric[];
    activeProductCount: number;
    soldProductCount: number;
    /** Only meaningful when there was at least one sale this period - see rules.ts's own condition for this. */
    notSoldCount: number | null;
  };

  intelligence: {
    counts: Record<FindingSeverity, number>;
    primaryConcern: FindingRef | null;
    secondaryConcerns: FindingRef[];
    positiveSignals: FindingRef[];
    recommendedFocus: string;
    findings: FindingRef[];
  };

  startPlan: StartActionPlan;
  insufficientData: boolean;
  comparisonAvailable: boolean;
  comparisonStatus: ComparisonStatus;
  comparisonLimitation: string | null;
};

const SEVERITIES: FindingSeverity[] = ["critical", "warning", "opportunity", "positive", "neutral"];

function countBySeverity(findings: FindingRef[]): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = {
    critical: 0,
    warning: 0,
    opportunity: 0,
    positive: 0,
    neutral: 0,
  };
  for (const f of findings) counts[f.severity]++;
  return counts;
}

/**
 * PHASE 6 REPORTS (Section 1)
 * ---------------------------------------------------------------------------
 * A pure composition layer over existing Phase 3/4/5 services - it
 * calculates and evaluates nothing itself. Every number here is read
 * directly from:
 *   - calculateFinancialSummary (Phase 3) for Business Summary
 *   - getSalesMetrics / getActiveProductCount (Phase 4's own metrics
 *     layer) for Sales Summary
 *   - generateAiSynthesis (Phase 5, which itself wraps Phase 4's
 *     generateIntelligenceReport) for Intelligence Summary + START
 *     Summary
 *
 * Historical integrity is inherited for free: calculateFinancialSummary
 * and getSalesMetrics both read exclusively from sale_items' frozen
 * snapshot columns (see their own doc comments), so a report for a past
 * period never recalculates using current prices/HPP - exactly like
 * every other Phase 3/4 view in this app.
 * ------------------------------------------------------------------------ */
export async function generateBusinessReport(
  businessId: string,
  period: DateRange
): Promise<BusinessReport> {
  const [financial, salesMetrics, activeProductCount, synthesis] = await Promise.all([
    calculateFinancialSummary(businessId, period),
    getSalesMetrics(businessId, period),
    getActiveProductCount(businessId),
    generateAiSynthesis(businessId, period),
  ]);

  const soldProductCount = salesMetrics.soldProductIds.size;
  // Mirrors modules/intelligence/rules.ts's own condition for the
  // "products with no sales" opportunity finding exactly - only
  // meaningful when there was at least one sale this period at all.
  const notSoldCount =
    salesMetrics.saleCount > 0 && activeProductCount > 0
      ? Math.max(0, activeProductCount - soldProductCount)
      : null;

  return {
    businessId,
    period: synthesis.period,
    comparisonPeriod: synthesis.comparisonPeriod,
    generatedAt: synthesis.generatedAt,
    aiProvider: synthesis.provider,

    business: {
      revenue: financial.revenue,
      cogs: financial.cogs,
      grossProfit: financial.grossProfit,
      operatingExpenses: financial.operatingExpenses,
      operatingResult: financial.operatingResult,
      capital: financial.capital,
      ownerDrawings: financial.ownerDrawings,
    },

    sales: {
      saleCount: salesMetrics.saleCount,
      revenue: salesMetrics.revenue,
      bestPerformingProducts: salesMetrics.productMetrics.slice(0, 3),
      activeProductCount,
      soldProductCount,
      notSoldCount,
    },

    intelligence: {
      counts: countBySeverity(synthesis.prioritizedFindings),
      primaryConcern: synthesis.primaryConcern,
      secondaryConcerns: synthesis.secondaryConcerns,
      positiveSignals: synthesis.positiveSignals,
      recommendedFocus: synthesis.recommendedFocus,
      findings: synthesis.prioritizedFindings,
    },

    startPlan: synthesis.startPlan,
    insufficientData: synthesis.insufficientData,
    comparisonAvailable: synthesis.comparisonAvailable,
    comparisonStatus: synthesis.comparisonStatus,
    comparisonLimitation: synthesis.comparisonLimitation,
  };
}

export { SEVERITIES as REPORT_SEVERITY_ORDER };
