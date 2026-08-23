import type { Finding } from "@/modules/intelligence/types";
import { THRESHOLDS } from "@/modules/intelligence/rules";
import { prioritizeFindings, toFindingRef } from "./priority";
import type { StartActionPlan } from "./types";

function num(value: Finding["metrics"][string]): number {
  return typeof value === "number" ? value : 0;
}

function text(value: Finding["metrics"][string], fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function pct(fraction: number): string {
  return `${(fraction * 100).toFixed(0)}%`;
}

type TemplateResult = {
  target: string;
  action: string;
  review: string;
  track: string[];
};

/**
 * START TEMPLATES (Phase 5, Section 4)
 * ---------------------------------------------------------------------------
 * One deterministic template per finding id defined in
 * modules/intelligence/rules.ts. Every field is built from the
 * finding's own metrics (or, where relevant, the same fixed THRESHOLDS
 * constants rules.ts itself used to produce the finding) - never a
 * fabricated number. `track` lists human-readable indicator names
 * (matching the Phase 5 spec's example output), not raw metric keys.
 * ------------------------------------------------------------------------ */
const TEMPLATES: Record<string, (f: Finding) => TemplateResult> = {
  "sales-no-activity": () => ({
    target: "Record at least one completed sale in the next analysis period.",
    action:
      "Confirm that every completed transaction is being entered into the system, and record any sale that may be missing.",
    review: "Check whether at least one sale has been recorded since this review.",
    track: ["Sale Count", "Revenue"],
  }),
  "sales-low-activity": (f) => ({
    target: `Bring completed sales back above the ${num(f.metrics.threshold)}-sale threshold used to flag low activity.`,
    action:
      "Identify the slowest days or hours in the period and consider a promotion, adjusted hours, or direct outreach to regular customers.",
    review: `Compare the next period's sale count against this period's ${num(f.metrics.saleCount)} sale(s).`,
    track: ["Sale Count", "Revenue"],
  }),
  "sales-comparison-insufficient-data": () => ({
    target: "Keep operating consistently until a full comparable period of history exists.",
    action: "Continue recording sales as normal; no comparison-based action is needed yet.",
    review: "Re-run this analysis once a full previous equivalent period of history is available.",
    track: ["Revenue", "Sale Count"],
  }),
  "sales-comparison-no-previous-activity": (f) => {
    const hasRevenueNow = num(f.metrics.currentRevenue) > 0;
    return {
      target: hasRevenueNow
        ? "Sustain sales momentum now that activity has started from zero."
        : "Record this business's first completed sale.",
      action: hasRevenueNow
        ? "Identify what generated this period's revenue and look for ways to repeat or scale it."
        : "Begin recording completed sales so future comparisons become meaningful.",
      review: "Compare the next period's revenue against this period's.",
      track: ["Revenue", "Sale Count"],
    };
  },
  "sales-growth": (f) => ({
    target: `Sustain or extend the ${text(f.metrics.changePct)} revenue growth into the next period.`,
    action:
      "Identify what drove the increase (products, promotions, timing) and repeat it deliberately rather than relying on it recurring by chance.",
    review: `Compare the next period's revenue against this period's ${num(f.metrics.currentRevenue)}.`,
    track: ["Revenue", "Sale Count"],
  }),
  "sales-decline": (f) => ({
    target: `Recover the ${text(f.metrics.changePct)} revenue decline versus the previous period.`,
    action:
      "Review which products or days lost the most revenue and investigate whether price, availability, or demand changed.",
    review: `Compare the next period's revenue against this period's ${num(f.metrics.currentRevenue)} (previously ${num(f.metrics.previousRevenue)}).`,
    track: ["Revenue", "Sale Count"],
  }),
  "sales-comparison-zero-baseline": () => ({
    target: "Establish a non-zero revenue baseline for future comparisons.",
    action: "Continue recording sales; the previous period's zero-revenue baseline will be replaced as more history accumulates.",
    review: "Re-run this analysis once a previous period with nonzero revenue exists.",
    track: ["Revenue", "Sale Count"],
  }),
  "sales-best-performing-product": (f) => ({
    target: `Grow revenue further from "${text(f.metrics.productName)}" and identify what makes it perform well.`,
    action: "Consider whether this product's pricing, positioning, or availability can be applied to other products.",
    review: `Compare this product's revenue next period against this period's ${num(f.metrics.revenue)}.`,
    track: ["Product Revenue", "Quantity Sold"],
  }),
  "sales-products-with-no-sales": (f) => ({
    target: `Get at least some of the ${num(f.metrics.notSoldCount)} product(s) with no sales this period moving.`,
    action: "Review pricing, visibility, and demand for these products, and decide whether to promote, reprice, or retire each one.",
    review: "Check whether the count of unsold active products has decreased next period.",
    track: ["Unsold Product Count", "Active Product Count"],
  }),
  "profitability-negative-gross-profit": (f) => ({
    target: "Restore a positive gross profit.",
    action:
      "Review recipe costs (HPP) against selling prices for the products sold this period - prices may need to rise, or ingredient costs may need review.",
    review: `Compare the next period's gross profit against this period's ${num(f.metrics.grossProfit)}.`,
    track: ["Revenue", "COGS", "Gross Profit"],
  }),
  "profitability-low-margin": (f) => ({
    target: `Raise gross margin above the ${pct(THRESHOLDS.LOW_GROSS_MARGIN_PCT)} threshold, from this period's ${text(f.metrics.marginPct)}.`,
    action: "Identify which products carry the thinnest margins and consider price adjustments or lower-cost ingredient sourcing for them.",
    review: `Compare the next period's margin against this period's ${text(f.metrics.marginPct)}.`,
    track: ["Revenue", "Gross Profit"],
  }),
  "profitability-positive-gross-profit": (f) => ({
    target: `Maintain or improve the ${text(f.metrics.marginPct)} gross margin achieved this period.`,
    action: "Keep monitoring ingredient costs and selling prices so the current margin doesn't erode unnoticed.",
    review: `Compare the next period's margin against this period's ${text(f.metrics.marginPct)}.`,
    track: ["Revenue", "Gross Profit"],
  }),
  "expenses-high-pressure": (f) => ({
    target: `Bring operating expenses back under ${pct(THRESHOLDS.HIGH_EXPENSE_TO_REVENUE_PCT)} of revenue, from this period's ${text(f.metrics.ratioPct)}.`,
    action: "Review the largest expense categories and identify any non-essential spending that can be reduced.",
    review: `Compare the next period's expense-to-revenue ratio against this period's ${text(f.metrics.ratioPct)}.`,
    track: ["Operating Expenses", "Revenue"],
  }),
  "expenses-with-no-revenue": () => ({
    target: "Avoid recording expenses in periods with no matching revenue, or generate revenue alongside them.",
    action: "Review whether these expenses were necessary before any sales occurred, and confirm they were recorded in the correct period.",
    review: "Confirm whether revenue was recorded alongside expenses in the next period.",
    track: ["Operating Expenses", "Revenue"],
  }),
  "expenses-exceed-gross-profit": (f) => ({
    target: "Bring operating expenses back below gross profit.",
    action:
      "Compare the specific expense categories driving this period's total against gross profit and reduce the largest non-essential ones.",
    review: `Compare the next period's operating expenses (${num(f.metrics.operatingExpenses)}) against gross profit (${num(f.metrics.grossProfit)}).`,
    track: ["Operating Expenses", "Gross Profit"],
  }),
  "expenses-negative-operating-result": () => ({
    target: "Restore a positive operating result.",
    action: "Review the highest expense categories and reduce non-essential spending relative to gross profit.",
    review: "Compare operating expenses and gross profit after the next review period.",
    track: ["Revenue", "Gross Profit", "Operating Expenses", "Operating Result"],
  }),
  "expenses-significant-category": (f) => ({
    target: `Reduce reliance on the single "${text(f.metrics.category)}" expense category.`,
    action: "Break down this category's costs and evaluate which line items can be trimmed, delayed, or sourced more cheaply.",
    review: "Check whether this category's share of total expenses has decreased next period.",
    track: ["Expense Category Share", "Total Expenses"],
  }),
  "activity-no-transactions-ever": () => ({
    target: "Record the business's first transaction (sale, expense, capital, or drawing).",
    action: "Begin entering transactions as they happen so future analyses have real data to work with.",
    review: "Confirm at least one transaction has been recorded since this review.",
    track: ["Sale Count", "Operating Expenses"],
  }),
  "activity-no-recent-activity": (f) => ({
    target: "Resume regular business activity and record-keeping.",
    action: `Check why no transactions were recorded in the last ${num(f.metrics.daysSinceLastActivity)} day(s), and record any activity since ${text(f.metrics.lastActivityDate)} that may be missing.`,
    review: "Confirm new activity has been recorded since this review.",
    track: ["Last Activity Date", "Sale Count"],
  }),
  "activity-active": (f) => ({
    target: "Maintain the current pace of regular activity and record-keeping.",
    action: "Keep recording transactions promptly as they happen.",
    review: `Confirm the business remains active next period (last activity was ${num(f.metrics.daysSinceLastActivity)} day(s) ago).`,
    track: ["Last Activity Date"],
  }),
  "activity-revenue-without-positive-result": (f) => ({
    target: "Turn this period's revenue into a positive operating result.",
    action:
      "Compare gross profit against operating expenses for this period and identify which side needs to change first - pricing/cost, or spending.",
    review: `Compare the next period's operating result against this period's ${num(f.metrics.operatingResult)}.`,
    track: ["Revenue", "Operating Result"],
  }),
};

/** Non-fabricating fallback for any finding id not covered above (e.g. a future rule added to rules.ts without a matching template yet). */
function genericTemplate(f: Finding): TemplateResult {
  return {
    target: `Address the condition behind "${f.title}".`,
    action: "Review the details behind this finding and decide on an appropriate next step.",
    review: "Reassess this finding in the next analysis period.",
    track: Object.keys(f.metrics).length > 0 ? Object.keys(f.metrics) : ["Revenue", "Operating Result"],
  };
}

/**
 * Builds the START plan from the single highest-priority finding
 * (critical/warning concerns first, then opportunities, then positive
 * signals, then neutral notes - see priority.ts). This always grounds
 * the plan in a real, currently-true finding rather than inventing
 * generic advice, per Phase 5, Section 4.
 */
export function buildStartPlan(findings: Finding[]): StartActionPlan | null {
  if (findings.length === 0) return null;

  const [source] = prioritizeFindings(findings);
  const template = TEMPLATES[source.id] ?? genericTemplate;
  const { target, action, review, track } = template(source);

  return {
    situation: source.description,
    target,
    action,
    review,
    track,
    sourceFinding: toFindingRef(source),
  };
}
