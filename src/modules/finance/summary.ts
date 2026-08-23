import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { DateRange } from "./dateRanges";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type FinancialSummary = {
  range: DateRange;
  revenue: number;
  cogs: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingResult: number;
  capital: number;
  ownerDrawings: number;
  saleCount: number;
};

/**
 * FINANCIAL CALCULATION SOURCE OF TRUTH (Phase 3, Section 14-15)
 * ---------------------------------------------------------------------------
 * Revenue and COGS come exclusively from sale_items' frozen snapshot
 * columns (subtotal / totalHpp) — never from products' current selling
 * price or current HPP. This is what makes a financial summary for a
 * past period stay correct forever, even after prices/recipes/costs
 * have since changed many times over.
 *
 * Capital and Owner Drawings are summed and returned SEPARATELY — never
 * folded into revenue or operating expenses (Master Prompt Section 7).
 * Voided sales are excluded from Revenue/COGS entirely.
 * ------------------------------------------------------------------------ */
export async function calculateFinancialSummary(
  businessId: string,
  range: DateRange
): Promise<FinancialSummary> {
  const salesInRange = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.businessId, businessId), eq(schema.sales.status, "completed")))
    .all();

  const relevantSales = salesInRange.filter(
    (s) => s.transactionDate >= range.from && s.transactionDate <= range.to
  );

  const relevantSaleIds = new Set(relevantSales.map((s) => s.id));

  const allItems = await db
    .select()
    .from(schema.saleItems)
    .where(eq(schema.saleItems.businessId, businessId))
    .all();

  const relevantItems = allItems.filter((i) => relevantSaleIds.has(i.saleId));

  const revenue = roundMoney(relevantItems.reduce((sum, i) => sum + i.subtotal, 0));
  const cogs = roundMoney(relevantItems.reduce((sum, i) => sum + i.totalHpp, 0));
  const grossProfit = roundMoney(revenue - cogs);

  const allExpenses = await db
    .select()
    .from(schema.expenses)
    .where(eq(schema.expenses.businessId, businessId))
    .all();
  const relevantExpenses = allExpenses.filter(
    (e) => e.transactionDate >= range.from && e.transactionDate <= range.to
  );
  const operatingExpenses = roundMoney(relevantExpenses.reduce((sum, e) => sum + e.amount, 0));

  const operatingResult = roundMoney(grossProfit - operatingExpenses);

  const allCapital = await db
    .select()
    .from(schema.capitalTransactions)
    .where(eq(schema.capitalTransactions.businessId, businessId))
    .all();
  const relevantCapital = allCapital.filter(
    (c) => c.transactionDate >= range.from && c.transactionDate <= range.to
  );
  const capital = roundMoney(relevantCapital.reduce((sum, c) => sum + c.amount, 0));

  const allDrawings = await db
    .select()
    .from(schema.ownerDrawings)
    .where(eq(schema.ownerDrawings.businessId, businessId))
    .all();
  const relevantDrawings = allDrawings.filter(
    (d) => d.transactionDate >= range.from && d.transactionDate <= range.to
  );
  const ownerDrawings = roundMoney(relevantDrawings.reduce((sum, d) => sum + d.amount, 0));

  return {
    range,
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingResult,
    capital,
    ownerDrawings,
    saleCount: relevantSales.length,
  };
}
