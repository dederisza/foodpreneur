import type { DateRange } from "@/modules/finance/dateRanges";
import { previousEquivalentRange } from "@/modules/finance/dateRanges";
import type { Finding, FindingSeverity, IntelligenceReport, ComparisonAvailability } from "./types";
import {
  getSalesMetrics,
  getExpenseMetrics,
  getActivityMetrics,
  getActiveProductCount,
  getFinancialMetrics,
  getBusinessCreatedAt,
} from "./metrics";
import {
  evaluateSalesFindings,
  evaluateProfitabilityFindings,
  evaluateExpenseFindings,
  evaluateActivityFindings,
} from "./rules";
import type { SalesMetrics } from "./metrics";

/**
 * COMPARISON AVAILABILITY (Phase 4 fix)
 * ---------------------------------------------------------------------------
 * Replaces the previous hard-coded `comparisonAvailable: true`. A
 * comparison period is only meaningful if the business actually existed
 * for the whole of it — a business created partway through (or entirely
 * after) the comparison window has no valid baseline there, regardless
 * of whether zero or nonzero sales happen to be recorded in it. If the
 * business did exist for the whole comparison window, a genuine zero
 * sales result there is real information ("no_previous_activity"), not
 * missing data.
 * ------------------------------------------------------------------------ */
function determineComparisonAvailability(params: {
  businessCreatedAt: string | null;
  comparisonPeriod: DateRange;
  previous: SalesMetrics;
}): ComparisonAvailability {
  if (!params.businessCreatedAt || params.comparisonPeriod.from < params.businessCreatedAt) {
    // The business did not exist for all of the comparison period (or we
    // couldn't resolve a creation date at all) — no valid baseline.
    return "insufficient_data";
  }
  if (params.previous.saleCount === 0) {
    return "no_previous_activity";
  }
  return "available";
}

/**
 * INTELLIGENCE ENGINE ORCHESTRATOR (data -> metrics -> rules -> findings)
 * ---------------------------------------------------------------------------
 * This is the only function API routes / pages should call. It:
 *   1. Gathers metrics for the requested period (and, for comparison,
 *      the immediately preceding equivalent period).
 *   2. Determines whether that comparison is actually valid (see
 *      determineComparisonAvailability above).
 *   3. Runs each category's deterministic rule evaluator against those
 *      metrics.
 *   4. Returns a single IntelligenceReport with all findings plus a
 *      severity count for the UI's summary banner.
 *
 * Nothing here is AI - every step is a plain, explainable calculation
 * over Phase 1-3 data. Nothing is persisted; calling this function twice
 * with the same inputs always recomputes fresh from current transaction
 * data (see the note in types.ts on why findings aren't stored).
 * ------------------------------------------------------------------------ */
export async function generateIntelligenceReport(
  businessId: string,
  period: DateRange
): Promise<IntelligenceReport> {
  const comparisonPeriod = previousEquivalentRange(period);
  const now = new Date();

  const [
    financial,
    salesMetrics,
    previousSalesMetrics,
    expenseMetrics,
    activityMetrics,
    activeProductCount,
    businessCreatedAt,
  ] = await Promise.all([
    getFinancialMetrics(businessId, period),
    getSalesMetrics(businessId, period),
    getSalesMetrics(businessId, comparisonPeriod),
    getExpenseMetrics(businessId, period),
    getActivityMetrics(businessId, period),
    getActiveProductCount(businessId),
    getBusinessCreatedAt(businessId),
  ]);

  const comparisonAvailability = determineComparisonAvailability({
    businessCreatedAt,
    comparisonPeriod,
    previous: previousSalesMetrics,
  });

  const findings: Finding[] = [
    ...evaluateSalesFindings({
      businessId,
      period,
      current: salesMetrics,
      previous: previousSalesMetrics,
      comparisonAvailability,
      activeProductCount,
    }),
    ...evaluateProfitabilityFindings({ businessId, period, financial }),
    ...evaluateExpenseFindings({ businessId, period, financial, expenses: expenseMetrics }),
    ...evaluateActivityFindings({ businessId, period, financial, activity: activityMetrics, now }),
  ];

  const counts: Record<FindingSeverity, number> = {
    critical: 0,
    warning: 0,
    opportunity: 0,
    positive: 0,
    neutral: 0,
  };
  for (const f of findings) counts[f.severity]++;

  return { businessId, period, comparisonPeriod, findings, counts };
}
