import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Expense } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";
import { isValidExpenseCategory } from "./categories";

export class ValidationError extends Error {}

export async function createExpense(params: {
  businessId: string;
  transactionDate?: string;
  amount: number;
  category: string;
  description?: string;
  notes?: string;
}): Promise<Expense> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new ValidationError("Expense amount must be greater than zero.");
  }
  if (!isValidExpenseCategory(params.category)) {
    throw new ValidationError("Invalid expense category.");
  }

  const transactionDate = params.transactionDate ?? new Date().toISOString();
  if (Number.isNaN(new Date(transactionDate).getTime())) {
    throw new ValidationError("Transaction date is invalid.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.expenses)
    .values({
      id,
      businessId: params.businessId,
      transactionDate,
      amount: params.amount,
      category: params.category,
      description: params.description?.trim() || null,
      notes: params.notes,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getOwnedExpenseOrThrow(params.businessId, id);
}

export async function getOwnedExpenseOrThrow(
  businessId: string,
  expenseId: string
): Promise<Expense> {
  const expense = await db
    .select()
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, expenseId), eq(schema.expenses.businessId, businessId)))
    .get();
  if (!expense) {
    throw new OwnershipError("Expense not found or not owned by the current business.");
  }
  return expense;
}

export async function listExpenses(
  businessId: string,
  range?: { from: string; to: string }
): Promise<Expense[]> {
  const rows = await db
    .select()
    .from(schema.expenses)
    .where(eq(schema.expenses.businessId, businessId))
    .all();
  const filtered = range
    ? rows.filter((e) => e.transactionDate >= range.from && e.transactionDate <= range.to)
    : rows;
  return filtered.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/**
 * Expenses are not a historical-snapshot table (nothing else references
 * a point-in-time expense value the way a sale_item references a sale),
 * so editing in place is safe — unlike sales, which are voided instead
 * of edited. See Phase 3 Section 19 / 23.
 */
export async function updateExpense(
  businessId: string,
  expenseId: string,
  params: {
    transactionDate?: string;
    amount?: number;
    category?: string;
    description?: string | null;
    notes?: string | null;
  }
): Promise<Expense> {
  await getOwnedExpenseOrThrow(businessId, expenseId);

  const updates: Partial<typeof schema.expenses.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (params.amount !== undefined) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new ValidationError("Expense amount must be greater than zero.");
    }
    updates.amount = params.amount;
  }
  if (params.category !== undefined) {
    if (!isValidExpenseCategory(params.category)) {
      throw new ValidationError("Invalid expense category.");
    }
    updates.category = params.category;
  }
  if (params.transactionDate !== undefined) {
    if (Number.isNaN(new Date(params.transactionDate).getTime())) {
      throw new ValidationError("Transaction date is invalid.");
    }
    updates.transactionDate = params.transactionDate;
  }
  if (params.description !== undefined) {
    updates.description = params.description?.trim() || null;
  }
  if (params.notes !== undefined) {
    updates.notes = params.notes;
  }

  await db
    .update(schema.expenses)
    .set(updates)
    .where(and(eq(schema.expenses.id, expenseId), eq(schema.expenses.businessId, businessId)))
    .run();

  return getOwnedExpenseOrThrow(businessId, expenseId);
}

export async function deleteExpense(businessId: string, expenseId: string): Promise<void> {
  await getOwnedExpenseOrThrow(businessId, expenseId);
  await db
    .delete(schema.expenses)
    .where(and(eq(schema.expenses.id, expenseId), eq(schema.expenses.businessId, businessId)))
    .run();
}
