import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { DateRange } from "@/modules/finance/dateRanges";
import { calculateFinancialSummary, type FinancialSummary } from "@/modules/finance/summary";
import { listExpenses } from "@/modules/finance/expenses";
import { listCapitalTransactions } from "@/modules/finance/capital";
import { listOwnerDrawings } from "@/modules/finance/drawings";
import { listProducts } from "@/modules/catalog/products";

/**
 * METRICS LAYER (data → metrics → rules → findings)
 * ---------------------------------------------------------------------------
 * This module only reads and aggregates existing Phase 1-3 data — it
 * never recalculates financials from current product state. Revenue,
 * COGS, and per-product figures all come from `calculateFinancialSummary`
 * and `sale_items`' frozen snapshot columns (subtotal / totalHpp),
 * exactly like Phase 3's financial summary — see Phase 4 Section
 * "PROFITABILITY": historical intelligence must never use current
 * prices or current HPP, only historical snapshots.
 * ------------------------------------------------------------------------ */

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type ProductSalesMetric = {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
};

export type SalesMetrics = {
  saleCount: number;
  revenue: number;
  productMetrics: ProductSalesMetric[]; // sold in this period, revenue descending
  soldProductIds: Set<string>;
};

export type ExpenseMetrics = {
  total: number;
  byCategory: Record<string, number>;
};

export type ActivityMetrics = {
  /** Most recent transaction date across sales/expenses/capital/drawings, or null if the business has none at all. */
  lastActivityDate: string | null;
  /** Most recent COMPLETED (non-voided) sale date, or null. */
  lastSaleDate: string | null;
  transactionCountInPeriod: number;
};

/**
 * Aggregates sale_items (for non-voided sales only) within `range` by
 * product — this is the only place Phase 4 reads sale_items directly,
 * mirroring the same non-double-counting care as
 * modules/finance/transactionHistory.ts (which deliberately does NOT
 * read sale_items, since it only needs one row per sale — here we
 * genuinely need the per-item breakdown for "best performing product"
 * and "product with no sales").
 */
export async function getSalesMetrics(
  businessId: string,
  range: DateRange
): Promise<SalesMetrics> {
  const sales = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.businessId, businessId), eq(schema.sales.status, "completed")))
    .all();

  const relevantSales = sales.filter(
    (s) => s.transactionDate >= range.from && s.transactionDate <= range.to
  );
  const relevantSaleIds = new Set(relevantSales.map((s) => s.id));

  const allItems = await db
    .select()
    .from(schema.saleItems)
    .where(eq(schema.saleItems.businessId, businessId))
    .all();
  const relevantItems = allItems.filter((i) => relevantSaleIds.has(i.saleId));

  const byProduct = new Map<string, ProductSalesMetric>();
  for (const item of relevantItems) {
    const existing = byProduct.get(item.productId);
    if (existing) {
      existing.quantitySold += item.quantity;
      existing.revenue = roundMoney(existing.revenue + item.subtotal);
    } else {
      byProduct.set(item.productId, {
        productId: item.productId,
        productName: item.productNameSnapshot,
        quantitySold: item.quantity,
        revenue: roundMoney(item.subtotal),
      });
    }
  }

  const productMetrics = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);
  const revenue = roundMoney(relevantItems.reduce((sum, i) => sum + i.subtotal, 0));

  return {
    saleCount: relevantSales.length,
    revenue,
    productMetrics,
    soldProductIds: new Set(byProduct.keys()),
  };
}

export async function getExpenseMetrics(
  businessId: string,
  range: DateRange
): Promise<ExpenseMetrics> {
  const expenses = await listExpenses(businessId, range);
  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    byCategory[e.category] = roundMoney((byCategory[e.category] ?? 0) + e.amount);
  }
  const total = roundMoney(expenses.reduce((sum, e) => sum + e.amount, 0));
  return { total, byCategory };
}

/**
 * Activity is evaluated against a rolling window from "now" (not the
 * user-selected analysis period) — "no recent activity" should mean
 * "nothing happened lately", regardless of which historical period the
 * person is currently browsing.
 */
export async function getActivityMetrics(
  businessId: string,
  periodForCount: DateRange
): Promise<ActivityMetrics> {
  const [sales, expenses, capital, drawings] = await Promise.all([
    db.select().from(schema.sales).where(eq(schema.sales.businessId, businessId)).all(),
    listExpenses(businessId),
    listCapitalTransactions(businessId),
    listOwnerDrawings(businessId),
  ]);

  const completedSales = sales.filter((s) => s.status === "completed");

  const allDates = [
    ...completedSales.map((s) => s.transactionDate),
    ...expenses.map((e) => e.transactionDate),
    ...capital.map((c) => c.transactionDate),
    ...drawings.map((d) => d.transactionDate),
  ];

  const lastActivityDate =
    allDates.length > 0 ? allDates.reduce((a, b) => (b > a ? b : a)) : null;

  const saleDates = completedSales.map((s) => s.transactionDate);
  const lastSaleDate = saleDates.length > 0 ? saleDates.reduce((a, b) => (b > a ? b : a)) : null;

  const transactionCountInPeriod =
    completedSales.filter(
      (s) => s.transactionDate >= periodForCount.from && s.transactionDate <= periodForCount.to
    ).length +
    expenses.filter(
      (e) => e.transactionDate >= periodForCount.from && e.transactionDate <= periodForCount.to
    ).length +
    capital.filter(
      (c) => c.transactionDate >= periodForCount.from && c.transactionDate <= periodForCount.to
    ).length +
    drawings.filter(
      (d) => d.transactionDate >= periodForCount.from && d.transactionDate <= periodForCount.to
    ).length;

  return { lastActivityDate, lastSaleDate, transactionCountInPeriod };
}

export async function getActiveProductCount(businessId: string): Promise<number> {
  const products = await listProducts(businessId);
  return products.length;
}

export async function getFinancialMetrics(
  businessId: string,
  range: DateRange
): Promise<FinancialSummary> {
  return calculateFinancialSummary(businessId, range);
}

/**
 * Used to determine whether a comparison period is even meaningful
 * (Phase 4 fix — see determineComparisonAvailability in engine.ts): a
 * business that didn't exist yet during (all or part of) the comparison
 * period has genuinely insufficient historical data, which is a
 * different condition from "the business existed but simply had zero
 * sales that period."
 */
export async function getBusinessCreatedAt(businessId: string): Promise<string | null> {
  const business = await db
    .select({ createdAt: schema.businesses.createdAt })
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  return business?.createdAt ?? null;
}
