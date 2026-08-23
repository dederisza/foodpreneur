import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { DateRange } from "./dateRanges";

/**
 * UNIFIED TRANSACTION HISTORY
 * ---------------------------------------------------------------------------
 * This is a VIEW over four existing tables (sales, expenses,
 * capital_transactions, owner_drawings) — not a new universal
 * transaction table. Each source table already has its own service
 * module and its own historical-integrity rules (sales are voided, never
 * edited; the others are edited/deleted in place); this module only
 * reads and normalizes them into one chronological shape for display.
 * Nothing here writes to any table.
 *
 * A sale contributes exactly ONE entry to this history, regardless of
 * how many sale_items it contains — the amount is the sale's own
 * denormalized totalAmount, not a per-item breakdown. This is what
 * "do not double-count individual sale items" means in practice: the
 * sale_items table is never queried here at all.
 *
 * Voided sales are excluded, consistent with how modules/finance/summary.ts
 * already excludes them from Revenue/COGS — a voided sale shouldn't
 * appear as if it were still a real transaction.
 * ------------------------------------------------------------------------ */

export type TransactionType = "sale" | "expense" | "capital" | "owner_drawing";

export type TransactionEntry = {
  id: string;
  type: TransactionType;
  date: string;
  amount: number;
  description: string;
  category: string | null;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function listTransactionHistory(
  businessId: string,
  range?: DateRange
): Promise<TransactionEntry[]> {
  const [sales, expenses, capitalTransactions, ownerDrawings] = await Promise.all([
    db.select().from(schema.sales).where(eq(schema.sales.businessId, businessId)).all(),
    db.select().from(schema.expenses).where(eq(schema.expenses.businessId, businessId)).all(),
    db
      .select()
      .from(schema.capitalTransactions)
      .where(eq(schema.capitalTransactions.businessId, businessId))
      .all(),
    db
      .select()
      .from(schema.ownerDrawings)
      .where(eq(schema.ownerDrawings.businessId, businessId))
      .all(),
  ]);

  const entries: TransactionEntry[] = [];

  for (const sale of sales) {
    if (sale.status === "voided") continue; // see module comment above
    entries.push({
      id: sale.id,
      type: "sale",
      date: sale.transactionDate,
      amount: roundMoney(sale.totalAmount),
      description: `Sale ${sale.transactionNumber}`,
      category: sale.paymentMethod,
    });
  }

  for (const expense of expenses) {
    entries.push({
      id: expense.id,
      type: "expense",
      date: expense.transactionDate,
      amount: roundMoney(expense.amount),
      description: expense.description ?? expense.category,
      category: expense.category,
    });
  }

  for (const capital of capitalTransactions) {
    entries.push({
      id: capital.id,
      type: "capital",
      date: capital.transactionDate,
      amount: roundMoney(capital.amount),
      description: capital.notes ?? capital.source ?? "Capital injection",
      category: capital.source,
    });
  }

  for (const drawing of ownerDrawings) {
    entries.push({
      id: drawing.id,
      type: "owner_drawing",
      date: drawing.transactionDate,
      amount: roundMoney(drawing.amount),
      description: drawing.notes ?? "Owner drawing",
      category: null,
    });
  }

  const filtered = range
    ? entries.filter((e) => e.date >= range.from && e.date <= range.to)
    : entries;

  // Chronological (most recent first), matching the existing list
  // conventions in modules/sales/service.ts, modules/finance/expenses.ts,
  // etc. Ties broken by type then id for a fully deterministic order.
  return filtered.sort((a, b) => {
    const byDate = b.date.localeCompare(a.date);
    if (byDate !== 0) return byDate;
    const byType = a.type.localeCompare(b.type);
    if (byType !== 0) return byType;
    return a.id.localeCompare(b.id);
  });
}
