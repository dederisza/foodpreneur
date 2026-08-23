import { DummyAiProvider } from "../src/modules/ai/dummyProvider";
import { buildStartPlan } from "../src/modules/ai/start";
import type { Finding } from "../src/modules/intelligence/types";
import type { AiSynthesisContext } from "../src/modules/ai/types";

const provider = new DummyAiProvider();

function mkFinding(overrides: Partial<Finding> & Pick<Finding, "id" | "category" | "severity" | "title" | "description">): Finding {
  return {
    businessId: "biz-test",
    metrics: {},
    period: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z" },
    evaluatedAt: "2026-08-23T00:00:00.000Z",
    ...overrides,
  };
}

async function run() {
  let failures = 0;
  function assert(cond: boolean, label: string) {
    if (!cond) {
      failures++;
      console.log(`  FAIL: ${label}`);
    } else {
      console.log(`  pass: ${label}`);
    }
  }

  // --- Scenario: ONLY a comparison-insufficient-data marker, no other findings at all (Phase 5 fix) ---
  console.log("\n[Scenario] Only comparison-insufficient-data marker present, no other findings (Phase 5 fix)");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "sales-comparison-insufficient-data",
        category: "sales",
        severity: "neutral",
        title: "Not enough historical data to compare against the previous period",
        description: "This business did not exist for all of the immediately preceding equivalent period.",
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 0, warning: 0, opportunity: 0, positive: 0, neutral: 1 },
    };
    const out = await provider.generateSynthesis(ctx);
    // A comparison-only limitation must NEVER by itself flip the overall
    // insufficientData flag (Phase 5 fix) - it is surfaced separately
    // via comparisonStatus/comparisonAvailable/comparisonLimitation.
    assert(out.insufficientData === false, `insufficientData is false - a comparison marker alone is not "no data" (got ${out.insufficientData})`);
    assert(out.comparisonStatus === "insufficient_data", "comparisonStatus correctly reflects the comparison limitation");
    assert(out.comparisonAvailable === false, "comparisonAvailable is false");
    assert(out.primaryConcern === null, "no primary concern fabricated");
    const plan = buildStartPlan(findings);
    assert(plan !== null && plan.sourceFinding.id === "sales-comparison-insufficient-data", "START plan derived from the only available finding");
  }

  // --- Scenario: genuinely insufficient overall data (no transactions ever, no concern/positive/opportunity) ---
  console.log("\n[Scenario] Genuinely insufficient overall data - no transactions ever, nothing else");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "activity-no-transactions-ever",
        category: "activity",
        severity: "neutral",
        title: "No transactions recorded yet",
        description: "This business has no sales, expenses, capital, or owner drawing records at all yet.",
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 0, warning: 0, opportunity: 0, positive: 0, neutral: 1 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.insufficientData === true, "insufficientData is true - genuinely no business data at all");
    assert(out.summary.includes("no sales, expenses, capital"), "summary grounded in the actual finding description");
  }

  // --- Scenario: multiple simultaneous findings, priority ordering ---
  console.log("\n[Scenario] Multiple simultaneous findings - priority ordering");
  {
    const findings: Finding[] = [
      mkFinding({ id: "sales-decline", category: "sales", severity: "warning", title: "Sales decline", description: "Revenue fell 15%.", metrics: { changePct: "-15.0%", currentRevenue: 100, previousRevenue: 118 } }),
      mkFinding({ id: "profitability-negative-gross-profit", category: "profitability", severity: "critical", title: "Negative gross profit", description: "Gross profit is -50.", metrics: { grossProfit: -50, revenue: 100, cogs: 150 } }),
      mkFinding({ id: "activity-active", category: "activity", severity: "positive", title: "Active", description: "Active recently.", metrics: {} }),
      mkFinding({ id: "expenses-negative-operating-result", category: "expenses", severity: "critical", title: "Negative operating result", description: "Operating result is -80.", metrics: { operatingResult: -80, grossProfit: -50, operatingExpenses: 30 } }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 2, warning: 1, opportunity: 0, positive: 1, neutral: 0 },
    };
    const out = await provider.generateSynthesis(ctx);
    // Tie between two criticals (profitability vs expenses) -> category rank: profitability(0) < expenses(1)
    assert(out.primaryConcern?.id === "profitability-negative-gross-profit", `primary concern is the category-prioritized critical finding (got ${out.primaryConcern?.id})`);
    assert(out.secondaryConcerns.length === 2, `secondary concerns include remaining critical + warning (got ${out.secondaryConcerns.length})`);
    assert(out.positiveSignals.length === 1 && out.positiveSignals[0].id === "activity-active", "positive signal captured");
    const plan = buildStartPlan(findings);
    assert(plan?.sourceFinding.id === "profitability-negative-gross-profit", "START plan grounded in the top-priority finding");
  }

  // --- Scenario: no critical findings at all (only positive + opportunity) ---
  console.log("\n[Scenario] No critical findings - only opportunity + positive");
  {
    const findings: Finding[] = [
      mkFinding({ id: "sales-products-with-no-sales", category: "sales", severity: "opportunity", title: "2 products with no sales", description: "2 of 5 active products had no sales.", metrics: { activeProductCount: 5, soldProductCount: 3, notSoldCount: 2 } }),
      mkFinding({ id: "profitability-positive-gross-profit", category: "profitability", severity: "positive", title: "Healthy gross profit", description: "Gross profit is 500, a 40% margin.", metrics: { grossProfit: 500, revenue: 1250, marginPct: "40.0%" } }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 0, warning: 0, opportunity: 1, positive: 1, neutral: 0 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.primaryConcern === null, "no primary concern when nothing is critical/warning");
    assert(out.insufficientData === false, "NOT flagged insufficient data (there IS real, positive data)");
    assert(out.recommendedFocus.includes("Maintain"), "recommended focus reflects a healthy business");
    const plan = buildStartPlan(findings);
    // ordered[0] should be the opportunity finding (rank 2) since no critical/warning (rank 0/1) present
    assert(plan?.sourceFinding.id === "sales-products-with-no-sales", `START plan grounded in top opportunity (got ${plan?.sourceFinding.id})`);
  }

  // --- Scenario: determinism - same context twice ---
  console.log("\n[Scenario] Determinism - identical context produces identical output");
  {
    const findings: Finding[] = [
      mkFinding({ id: "expenses-high-pressure", category: "expenses", severity: "warning", title: "High expenses", description: "Expenses are 60% of revenue.", metrics: { operatingExpenses: 600, revenue: 1000, ratioPct: "60.0%" } }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 0, warning: 1, opportunity: 0, positive: 0, neutral: 0 },
    };
    const out1 = await provider.generateSynthesis(ctx);
    const out2 = await provider.generateSynthesis(ctx);
    assert(JSON.stringify(out1) === JSON.stringify(out2), "two calls with identical input produce byte-identical output");
  }

  // --- Scenario: empty findings (defensive) ---
  console.log("\n[Scenario] Empty findings list (defensive)");
  {
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.999Z" },
      comparisonPeriod: null,
      findings: [],
      counts: { critical: 0, warning: 0, opportunity: 0, positive: 0, neutral: 0 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.insufficientData === true, "empty findings -> insufficientData true");
    assert(out.primaryConcern === null, "empty findings -> no primary concern");
    const plan = buildStartPlan([]);
    assert(plan === null, "buildStartPlan returns null for empty findings (orchestrator supplies its own fallback)");
  }

  // --- Scenario: Comparison insufficient-data alongside REAL current-period findings (Phase 5 fix) ---
  console.log("\n[Scenario] Comparison insufficient-data + valid current-period findings (Phase 5 fix)");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "sales-comparison-insufficient-data",
        category: "sales",
        severity: "neutral",
        title: "Not enough historical data to compare against the previous period",
        description: "This business did not exist for all of the immediately preceding equivalent period.",
      }),
      mkFinding({
        id: "profitability-positive-gross-profit",
        category: "profitability",
        severity: "positive",
        title: "Healthy gross profit",
        description: "Gross profit is 500, a 40% margin.",
        metrics: { grossProfit: 500, revenue: 1250, marginPct: "40.0%" },
      }),
      mkFinding({
        id: "sales-best-performing-product",
        category: "sales",
        severity: "positive",
        title: "Best-performing product: Iced Tea",
        description: '"Iced Tea" generated the most revenue.',
        metrics: { productId: "p1", productName: "Iced Tea", revenue: 300, quantitySold: 10 },
      }),
      mkFinding({
        id: "activity-active",
        category: "activity",
        severity: "positive",
        title: "Business activity is active",
        description: "Active recently.",
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 0, warning: 0, opportunity: 0, positive: 3, neutral: 1 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.insufficientData === false, `insufficientData is FALSE despite comparison marker (got ${out.insufficientData})`);
    assert(out.comparisonAvailable === false, "comparisonAvailable is false (comparison genuinely unavailable)");
    assert(out.comparisonStatus === "insufficient_data", `comparisonStatus is insufficient_data (got ${out.comparisonStatus})`);
    assert(out.comparisonLimitation !== null && out.comparisonLimitation.includes("did not exist"), "comparisonLimitation grounded in the actual finding");
    assert(!out.summary.toLowerCase().includes("grew") && !out.summary.toLowerCase().includes("declined"), "summary makes no growth/decline claim");
    assert(out.positiveSignals.length === 3, `all 3 positive signals still surfaced (got ${out.positiveSignals.length})`);
  }

  // --- Scenario: Comparison insufficient-data + warning/critical findings (no positives at all) ---
  console.log("\n[Scenario] Comparison insufficient-data + warning/critical findings, no positives");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "sales-comparison-insufficient-data",
        category: "sales",
        severity: "neutral",
        title: "Not enough historical data to compare against the previous period",
        description: "This business did not exist for all of the immediately preceding equivalent period.",
      }),
      mkFinding({
        id: "expenses-negative-operating-result",
        category: "expenses",
        severity: "critical",
        title: "Negative operating result",
        description: "Operating result for this period is -80.",
        metrics: { operatingResult: -80, grossProfit: -50, operatingExpenses: 30 },
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: null,
      findings,
      counts: { critical: 1, warning: 0, opportunity: 0, positive: 0, neutral: 1 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.insufficientData === false, `insufficientData is FALSE despite comparison marker (got ${out.insufficientData})`);
    assert(out.primaryConcern?.id === "expenses-negative-operating-result", "primary concern still correctly identified");
    assert(out.comparisonStatus === "insufficient_data", "comparisonStatus correctly reported");
  }

  // --- Scenario: valid comparison with growth ---
  console.log("\n[Scenario] Valid comparison with growth");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "sales-growth",
        category: "sales",
        severity: "positive",
        title: "Sales growth versus the previous period",
        description: "Revenue rose 20.0% (from 100 to 120).",
        metrics: { currentRevenue: 120, previousRevenue: 100, changePct: "20.0%" },
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: { from: "2026-07-01T00:00:00.000Z", to: "2026-07-31T23:59:59.999Z" },
      findings,
      counts: { critical: 0, warning: 0, opportunity: 0, positive: 1, neutral: 0 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.comparisonStatus === "available", "comparisonStatus is available");
    assert(out.comparisonAvailable === true, "comparisonAvailable is true");
    assert(out.comparisonLimitation === null, "no comparison limitation when comparison is fully available");
    assert(out.insufficientData === false, "insufficientData is false");
  }

  // --- Scenario: valid comparison with decline ---
  console.log("\n[Scenario] Valid comparison with decline");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "sales-decline",
        category: "sales",
        severity: "warning",
        title: "Sales decline versus the previous period",
        description: "Revenue fell 15.0% (from 118 to 100).",
        metrics: { currentRevenue: 100, previousRevenue: 118, changePct: "-15.0%" },
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: { from: "2026-07-01T00:00:00.000Z", to: "2026-07-31T23:59:59.999Z" },
      findings,
      counts: { critical: 0, warning: 1, opportunity: 0, positive: 0, neutral: 0 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.comparisonStatus === "available", "comparisonStatus is available even for a decline finding");
    assert(out.primaryConcern?.id === "sales-decline", "decline correctly identified as primary concern");
    assert(out.insufficientData === false, "insufficientData is false");
  }

  // --- Scenario: no_previous_period_activity (valid zero baseline) ---
  console.log("\n[Scenario] No previous period activity (valid zero, current period has sales)");
  {
    const findings: Finding[] = [
      mkFinding({
        id: "sales-comparison-no-previous-activity",
        category: "sales",
        severity: "positive",
        title: "No sales in the previous comparable period",
        description: "The previous equivalent period had no recorded sales, while this period recorded 200 in revenue.",
        metrics: { currentRevenue: 200, previousRevenue: 0 },
      }),
    ];
    const ctx: AiSynthesisContext = {
      businessId: "biz-test",
      period: findings[0].period,
      comparisonPeriod: { from: "2026-07-01T00:00:00.000Z", to: "2026-07-31T23:59:59.999Z" },
      findings,
      counts: { critical: 0, warning: 0, opportunity: 0, positive: 1, neutral: 0 },
    };
    const out = await provider.generateSynthesis(ctx);
    assert(out.comparisonStatus === "no_previous_period_activity", `comparisonStatus correctly derived (got ${out.comparisonStatus})`);
    assert(out.comparisonAvailable === true, "comparisonAvailable is true for a valid zero baseline");
    assert(out.insufficientData === false, "insufficientData is false");
  }

  console.log(`\n${failures === 0 ? "ALL UNIT TESTS PASSED" : `${failures} UNIT TEST(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

run();
