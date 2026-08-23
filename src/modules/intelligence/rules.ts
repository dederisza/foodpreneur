import type { Finding, FindingSeverity, ComparisonAvailability } from "./types";
import type { DateRange } from "@/modules/finance/dateRanges";
import type { FinancialSummary } from "@/modules/finance/summary";
import type { SalesMetrics, ExpenseMetrics, ActivityMetrics } from "./metrics";

/**
 * RULE THRESHOLDS (Phase 4)
 * ---------------------------------------------------------------------------
 * Every threshold used by the engine lives here, named and documented,
 * per the Phase 4 instruction to use "configurable or clearly documented
 * rule thresholds." These are deliberately simple fixed constants (not
 * per-business configuration) — appropriate for an MVP rules engine;
 * a future phase could make these business-configurable without
 * changing the rule logic itself.
 * ------------------------------------------------------------------------ */
export const THRESHOLDS = {
  /** Fewer than this many completed sales in the period is "low sales activity". */
  LOW_SALES_COUNT: 5,
  /** A period-over-period revenue change beyond this fraction counts as growth/decline (10%). */
  SALES_CHANGE_SIGNIFICANT_PCT: 0.1,
  /** Gross margin (grossProfit / revenue) below this fraction is "low margin" (20%). */
  LOW_GROSS_MARGIN_PCT: 0.2,
  /** Operating expenses above this fraction of revenue is "high expense pressure" (50%). */
  HIGH_EXPENSE_TO_REVENUE_PCT: 0.5,
  /** A single expense category consuming more than this fraction of total expenses is called out by name (40%). */
  SIGNIFICANT_EXPENSE_CATEGORY_PCT: 0.4,
  /** No activity at all in this many days counts as "no recent activity". */
  RECENT_ACTIVITY_DAYS: 14,
} as const;

function makeFinding(params: {
  id: string;
  businessId: string;
  category: Finding["category"];
  severity: FindingSeverity;
  title: string;
  description: string;
  metrics: Finding["metrics"];
  period: DateRange;
}): Finding {
  return { ...params, evaluatedAt: new Date().toISOString() };
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/* ---------------------------------------------------------------------------
 * 1. SALES PERFORMANCE
 * ------------------------------------------------------------------------ */
export function evaluateSalesFindings(params: {
  businessId: string;
  period: DateRange;
  current: SalesMetrics;
  previous: SalesMetrics | null;
  comparisonAvailability: ComparisonAvailability;
  activeProductCount: number;
}): Finding[] {
  const { businessId, period, current, previous, comparisonAvailability, activeProductCount } = params;
  const findings: Finding[] = [];

  if (current.saleCount === 0) {
    findings.push(
      makeFinding({
        id: "sales-no-activity",
        businessId,
        category: "sales",
        severity: "critical",
        title: "No sales activity in this period",
        description:
          "No completed sales were recorded in the selected period. Nothing else in the sales analysis can be evaluated until at least one sale is recorded.",
        metrics: { saleCount: 0 },
        period,
      })
    );
  } else if (current.saleCount < THRESHOLDS.LOW_SALES_COUNT) {
    findings.push(
      makeFinding({
        id: "sales-low-activity",
        businessId,
        category: "sales",
        severity: "warning",
        title: "Low sales activity",
        description: `Only ${current.saleCount} sale(s) were recorded in the selected period, below the ${THRESHOLDS.LOW_SALES_COUNT}-sale threshold used to flag low activity.`,
        metrics: { saleCount: current.saleCount, threshold: THRESHOLDS.LOW_SALES_COUNT },
        period,
      })
    );
  }

  // COMPARISON AVAILABILITY (Phase 4 fix): three genuinely distinct cases,
  // each producing a different finding — see the ComparisonAvailability
  // doc comment in types.ts for what each one means and why they must
  // not be collapsed into a single "true/false".
  if (comparisonAvailability === "insufficient_data") {
    findings.push(
      makeFinding({
        id: "sales-comparison-insufficient-data",
        businessId,
        category: "sales",
        severity: "neutral",
        title: "Not enough historical data to compare against the previous period",
        description:
          "This business did not exist for all of the immediately preceding equivalent period, so there is no valid baseline to compare against yet. This is not a warning about the business itself — it simply hasn't been running long enough for a fair comparison.",
        metrics: { currentRevenue: current.revenue },
        period,
      })
    );
  } else if (comparisonAvailability === "no_previous_activity") {
    // A genuine, valid zero — the business existed for the whole
    // comparison period but recorded no sales in it. Division by
    // previous.revenue (0) is never attempted here; this is reported as
    // its own explicit condition instead of a percentage.
    findings.push(
      makeFinding({
        id: "sales-comparison-no-previous-activity",
        businessId,
        category: "sales",
        severity: current.saleCount > 0 ? "positive" : "neutral",
        title: "No sales in the previous comparable period",
        description:
          current.saleCount > 0
            ? `The previous equivalent period had no recorded sales, while this period recorded ${current.revenue} in revenue — a genuine improvement from zero, though a percentage change isn't meaningful against a zero baseline.`
            : "Both this period and the previous comparable period have no recorded sales.",
        metrics: { currentRevenue: current.revenue, previousRevenue: 0 },
        period,
      })
    );
  } else if (previous && previous.revenue !== 0) {
    // "available": safe to divide, previous.revenue is guaranteed non-zero here.
    const change = (current.revenue - previous.revenue) / previous.revenue;
    if (change >= THRESHOLDS.SALES_CHANGE_SIGNIFICANT_PCT) {
      findings.push(
        makeFinding({
          id: "sales-growth",
          businessId,
          category: "sales",
          severity: "positive",
          title: "Sales growth versus the previous period",
          description: `Revenue rose ${pct(change)} compared with the immediately preceding equivalent period (from ${previous.revenue} to ${current.revenue}).`,
          metrics: {
            currentRevenue: current.revenue,
            previousRevenue: previous.revenue,
            changePct: pct(change),
          },
          period,
        })
      );
    } else if (change <= -THRESHOLDS.SALES_CHANGE_SIGNIFICANT_PCT) {
      findings.push(
        makeFinding({
          id: "sales-decline",
          businessId,
          category: "sales",
          severity: "warning",
          title: "Sales decline versus the previous period",
          description: `Revenue fell ${pct(Math.abs(change))} compared with the immediately preceding equivalent period (from ${previous.revenue} to ${current.revenue}).`,
          metrics: {
            currentRevenue: current.revenue,
            previousRevenue: previous.revenue,
            changePct: pct(change),
          },
          period,
        })
      );
    }
  } else if (previous) {
    // Rare edge case: comparisonAvailability === "available" (previous
    // period had at least one sale) but its revenue happens to be
    // exactly zero (e.g. a free/promotional sale). A percentage change
    // against a zero baseline is undefined — this is reported
    // explicitly rather than silently divided or silently dropped.
    findings.push(
      makeFinding({
        id: "sales-comparison-zero-baseline",
        businessId,
        category: "sales",
        severity: "neutral",
        title: "Previous period revenue was zero",
        description: `The previous comparable period recorded ${previous.saleCount} sale(s) but zero revenue, so a percentage change against it isn't meaningful. This period recorded ${current.revenue} in revenue.`,
        metrics: { currentRevenue: current.revenue, previousRevenue: 0, previousSaleCount: previous.saleCount },
        period,
      })
    );
  }

  if (current.productMetrics.length > 0) {
    const best = current.productMetrics[0];
    findings.push(
      makeFinding({
        id: "sales-best-performing-product",
        businessId,
        category: "sales",
        severity: "positive",
        title: `Best-performing product: ${best.productName}`,
        description: `"${best.productName}" generated the most revenue in this period (${best.revenue}, from ${best.quantitySold} unit(s) sold).`,
        metrics: {
          productId: best.productId,
          productName: best.productName,
          revenue: best.revenue,
          quantitySold: best.quantitySold,
        },
        period,
      })
    );
  }

  if (activeProductCount > 0) {
    const soldCount = current.soldProductIds.size;
    const notSoldCount = activeProductCount - soldCount;
    if (notSoldCount > 0 && current.saleCount > 0) {
      findings.push(
        makeFinding({
          id: "sales-products-with-no-sales",
          businessId,
          category: "sales",
          severity: "opportunity",
          title: `${notSoldCount} active product(s) had no sales this period`,
          description: `${notSoldCount} of ${activeProductCount} active product(s) did not appear in any sale during the selected period — worth checking whether they need promotion, repricing, or retirement.`,
          metrics: { activeProductCount, soldProductCount: soldCount, notSoldCount },
          period,
        })
      );
    }
  }

  return findings;
}

/* ---------------------------------------------------------------------------
 * 2. PROFITABILITY
 * ------------------------------------------------------------------------ */
export function evaluateProfitabilityFindings(params: {
  businessId: string;
  period: DateRange;
  financial: FinancialSummary;
}): Finding[] {
  const { businessId, period, financial } = params;
  const findings: Finding[] = [];

  if (financial.revenue === 0) {
    return findings;
  }

  if (financial.grossProfit <= 0) {
    findings.push(
      makeFinding({
        id: "profitability-negative-gross-profit",
        businessId,
        category: "profitability",
        severity: "critical",
        title: "Negative or zero gross profit",
        description: `Gross profit for this period is ${financial.grossProfit} (Revenue ${financial.revenue} - COGS ${financial.cogs}). Products sold this period cost as much or more to make than they earned.`,
        metrics: { revenue: financial.revenue, cogs: financial.cogs, grossProfit: financial.grossProfit },
        period,
      })
    );
    return findings;
  }

  const marginPct = financial.grossProfit / financial.revenue;
  if (marginPct < THRESHOLDS.LOW_GROSS_MARGIN_PCT) {
    findings.push(
      makeFinding({
        id: "profitability-low-margin",
        businessId,
        category: "profitability",
        severity: "warning",
        title: "Low gross margin",
        description: `Gross margin is ${pct(marginPct)}, below the ${pct(THRESHOLDS.LOW_GROSS_MARGIN_PCT)} threshold used to flag thin margins.`,
        metrics: { grossProfit: financial.grossProfit, revenue: financial.revenue, marginPct: pct(marginPct) },
        period,
      })
    );
  } else {
    findings.push(
      makeFinding({
        id: "profitability-positive-gross-profit",
        businessId,
        category: "profitability",
        severity: "positive",
        title: "Healthy gross profit",
        description: `Gross profit for this period is ${financial.grossProfit}, a ${pct(marginPct)} margin on ${financial.revenue} revenue.`,
        metrics: { grossProfit: financial.grossProfit, revenue: financial.revenue, marginPct: pct(marginPct) },
        period,
      })
    );
  }

  return findings;
}

/* ---------------------------------------------------------------------------
 * 3. EXPENSE PRESSURE
 * ------------------------------------------------------------------------ */
export function evaluateExpenseFindings(params: {
  businessId: string;
  period: DateRange;
  financial: FinancialSummary;
  expenses: ExpenseMetrics;
}): Finding[] {
  const { businessId, period, financial, expenses } = params;
  const findings: Finding[] = [];

  if (expenses.total === 0) {
    return findings;
  }

  if (financial.revenue > 0) {
    const expenseToRevenue = expenses.total / financial.revenue;
    if (expenseToRevenue > THRESHOLDS.HIGH_EXPENSE_TO_REVENUE_PCT) {
      findings.push(
        makeFinding({
          id: "expenses-high-pressure",
          businessId,
          category: "expenses",
          severity: "warning",
          title: "High operating expenses relative to revenue",
          description: `Operating expenses (${expenses.total}) are ${pct(expenseToRevenue)} of revenue (${financial.revenue}), above the ${pct(THRESHOLDS.HIGH_EXPENSE_TO_REVENUE_PCT)} threshold.`,
          metrics: {
            operatingExpenses: expenses.total,
            revenue: financial.revenue,
            ratioPct: pct(expenseToRevenue),
          },
          period,
        })
      );
    }
  } else {
    findings.push(
      makeFinding({
        id: "expenses-with-no-revenue",
        businessId,
        category: "expenses",
        severity: "critical",
        title: "Expenses recorded with no revenue this period",
        description: `${expenses.total} in expenses were recorded with zero revenue in the selected period.`,
        metrics: { operatingExpenses: expenses.total, revenue: 0 },
        period,
      })
    );
  }

  if (financial.grossProfit > 0 && expenses.total > financial.grossProfit) {
    findings.push(
      makeFinding({
        id: "expenses-exceed-gross-profit",
        businessId,
        category: "expenses",
        severity: "warning",
        title: "Operating expenses exceed gross profit",
        description: `Operating expenses (${expenses.total}) are higher than gross profit (${financial.grossProfit}) for this period.`,
        metrics: { operatingExpenses: expenses.total, grossProfit: financial.grossProfit },
        period,
      })
    );
  }

  if (financial.operatingResult < 0) {
    findings.push(
      makeFinding({
        id: "expenses-negative-operating-result",
        businessId,
        category: "expenses",
        severity: "critical",
        title: "Negative operating result",
        description: `Operating result for this period is ${financial.operatingResult} (Gross Profit ${financial.grossProfit} - Operating Expenses ${expenses.total}).`,
        metrics: {
          operatingResult: financial.operatingResult,
          grossProfit: financial.grossProfit,
          operatingExpenses: expenses.total,
        },
        period,
      })
    );
  }

  const [topCategory, topAmount] =
    Object.entries(expenses.byCategory).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  if (topCategory && topAmount / expenses.total > THRESHOLDS.SIGNIFICANT_EXPENSE_CATEGORY_PCT) {
    findings.push(
      makeFinding({
        id: "expenses-significant-category",
        businessId,
        category: "expenses",
        severity: "neutral",
        title: `"${topCategory}" is the dominant expense category`,
        description: `"${topCategory}" accounts for ${pct(topAmount / expenses.total)} of total expenses (${topAmount} of ${expenses.total}) this period.`,
        metrics: { category: topCategory, categoryAmount: topAmount, totalExpenses: expenses.total },
        period,
      })
    );
  }

  return findings;
}

/* ---------------------------------------------------------------------------
 * 4. BUSINESS ACTIVITY
 * ------------------------------------------------------------------------ */
export function evaluateActivityFindings(params: {
  businessId: string;
  period: DateRange;
  financial: FinancialSummary;
  activity: ActivityMetrics;
  now: Date;
}): Finding[] {
  const { businessId, period, financial, activity, now } = params;
  const findings: Finding[] = [];

  if (!activity.lastActivityDate) {
    findings.push(
      makeFinding({
        id: "activity-no-transactions-ever",
        businessId,
        category: "activity",
        severity: "neutral",
        title: "No transactions recorded yet",
        description:
          "This business has no sales, expenses, capital, or owner drawing records at all yet.",
        metrics: {},
        period,
      })
    );
    return findings;
  }

  const daysSinceLastActivity =
    (now.getTime() - new Date(activity.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSinceLastActivity > THRESHOLDS.RECENT_ACTIVITY_DAYS) {
    findings.push(
      makeFinding({
        id: "activity-no-recent-activity",
        businessId,
        category: "activity",
        severity: "critical",
        title: "No recent business activity",
        description: `No sales, expenses, capital, or owner drawing records in the last ${Math.floor(daysSinceLastActivity)} day(s) - beyond the ${THRESHOLDS.RECENT_ACTIVITY_DAYS}-day threshold used to flag inactivity.`,
        metrics: {
          lastActivityDate: activity.lastActivityDate,
          daysSinceLastActivity: Math.floor(daysSinceLastActivity),
        },
        period,
      })
    );
  } else {
    findings.push(
      makeFinding({
        id: "activity-active",
        businessId,
        category: "activity",
        severity: "positive",
        title: "Business activity is active",
        description: `The most recent recorded transaction was ${Math.floor(daysSinceLastActivity)} day(s) ago.`,
        metrics: {
          lastActivityDate: activity.lastActivityDate,
          daysSinceLastActivity: Math.floor(daysSinceLastActivity),
        },
        period,
      })
    );
  }

  if (financial.revenue > 0 && financial.operatingResult <= 0) {
    findings.push(
      makeFinding({
        id: "activity-revenue-without-positive-result",
        businessId,
        category: "activity",
        severity: "warning",
        title: "Revenue recorded, but operating result is not positive",
        description: `Revenue of ${financial.revenue} was recorded this period, but the operating result is ${financial.operatingResult} - the business is generating sales without generating profit.`,
        metrics: { revenue: financial.revenue, operatingResult: financial.operatingResult },
        period,
      })
    );
  }

  return findings;
}
