import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { CapitalTransaction } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";

export class ValidationError extends Error {}

/**
 * Capital is money injected into the business — NEVER counted as
 * revenue (Master Prompt Section 7; Phase 3 Section 12/15). This module
 * only records the transaction; modules/finance/summary.ts is
 * responsible for keeping it out of the revenue calculation.
 */
export async function createCapitalTransaction(params: {
  businessId: string;
  transactionDate?: string;
  amount: number;
  source?: string;
  notes?: string;
}): Promise<CapitalTransaction> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new ValidationError("Capital amount must be greater than zero.");
  }
  const transactionDate = params.transactionDate ?? new Date().toISOString();
  if (Number.isNaN(new Date(transactionDate).getTime())) {
    throw new ValidationError("Transaction date is invalid.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.capitalTransactions)
    .values({
      id,
      businessId: params.businessId,
      transactionDate,
      amount: params.amount,
      source: params.source?.trim() || null,
      notes: params.notes,
      createdAt: now,
    })
    .run();

  return getOwnedCapitalTransactionOrThrow(params.businessId, id);
}

export async function getOwnedCapitalTransactionOrThrow(
  businessId: string,
  id: string
): Promise<CapitalTransaction> {
  const row = await db
    .select()
    .from(schema.capitalTransactions)
    .where(
      and(eq(schema.capitalTransactions.id, id), eq(schema.capitalTransactions.businessId, businessId))
    )
    .get();
  if (!row) {
    throw new OwnershipError("Capital transaction not found or not owned by the current business.");
  }
  return row;
}

export async function listCapitalTransactions(
  businessId: string,
  range?: { from: string; to: string }
): Promise<CapitalTransaction[]> {
  const rows = await db
    .select()
    .from(schema.capitalTransactions)
    .where(eq(schema.capitalTransactions.businessId, businessId))
    .all();
  const filtered = range
    ? rows.filter((c) => c.transactionDate >= range.from && c.transactionDate <= range.to)
    : rows;
  return filtered.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export async function updateCapitalTransaction(
  businessId: string,
  id: string,
  params: { amount?: number; transactionDate?: string; source?: string | null; notes?: string | null }
): Promise<CapitalTransaction> {
  await getOwnedCapitalTransactionOrThrow(businessId, id);

  const updates: Partial<typeof schema.capitalTransactions.$inferInsert> = {};
  if (params.amount !== undefined) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new ValidationError("Capital amount must be greater than zero.");
    }
    updates.amount = params.amount;
  }
  if (params.transactionDate !== undefined) {
    if (Number.isNaN(new Date(params.transactionDate).getTime())) {
      throw new ValidationError("Transaction date is invalid.");
    }
    updates.transactionDate = params.transactionDate;
  }
  if (params.source !== undefined) updates.source = params.source?.trim() || null;
  if (params.notes !== undefined) updates.notes = params.notes;

  await db
    .update(schema.capitalTransactions)
    .set(updates)
    .where(
      and(eq(schema.capitalTransactions.id, id), eq(schema.capitalTransactions.businessId, businessId))
    )
    .run();

  return getOwnedCapitalTransactionOrThrow(businessId, id);
}

export async function deleteCapitalTransaction(businessId: string, id: string): Promise<void> {
  await getOwnedCapitalTransactionOrThrow(businessId, id);
  await db
    .delete(schema.capitalTransactions)
    .where(
      and(eq(schema.capitalTransactions.id, id), eq(schema.capitalTransactions.businessId, businessId))
    )
    .run();
}
