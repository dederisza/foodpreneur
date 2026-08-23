import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { OwnerDrawing } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";

export class ValidationError extends Error {}

/**
 * Owner drawings are money taken OUT of the business by the owner —
 * NEVER counted as an operating expense (Master Prompt Section 7; Phase
 * 3 Section 13/15). This module only records the transaction;
 * modules/finance/summary.ts is responsible for keeping it out of the
 * operating-expense calculation.
 */
export async function createOwnerDrawing(params: {
  businessId: string;
  transactionDate?: string;
  amount: number;
  notes?: string;
}): Promise<OwnerDrawing> {
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw new ValidationError("Owner drawing amount must be greater than zero.");
  }
  const transactionDate = params.transactionDate ?? new Date().toISOString();
  if (Number.isNaN(new Date(transactionDate).getTime())) {
    throw new ValidationError("Transaction date is invalid.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.ownerDrawings)
    .values({
      id,
      businessId: params.businessId,
      transactionDate,
      amount: params.amount,
      notes: params.notes,
      createdAt: now,
    })
    .run();

  return getOwnedDrawingOrThrow(params.businessId, id);
}

export async function getOwnedDrawingOrThrow(
  businessId: string,
  id: string
): Promise<OwnerDrawing> {
  const row = await db
    .select()
    .from(schema.ownerDrawings)
    .where(and(eq(schema.ownerDrawings.id, id), eq(schema.ownerDrawings.businessId, businessId)))
    .get();
  if (!row) {
    throw new OwnershipError("Owner drawing not found or not owned by the current business.");
  }
  return row;
}

export async function listOwnerDrawings(
  businessId: string,
  range?: { from: string; to: string }
): Promise<OwnerDrawing[]> {
  const rows = await db
    .select()
    .from(schema.ownerDrawings)
    .where(eq(schema.ownerDrawings.businessId, businessId))
    .all();
  const filtered = range
    ? rows.filter((d) => d.transactionDate >= range.from && d.transactionDate <= range.to)
    : rows;
  return filtered.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

export async function updateOwnerDrawing(
  businessId: string,
  id: string,
  params: { amount?: number; transactionDate?: string; notes?: string | null }
): Promise<OwnerDrawing> {
  await getOwnedDrawingOrThrow(businessId, id);

  const updates: Partial<typeof schema.ownerDrawings.$inferInsert> = {};
  if (params.amount !== undefined) {
    if (!Number.isFinite(params.amount) || params.amount <= 0) {
      throw new ValidationError("Owner drawing amount must be greater than zero.");
    }
    updates.amount = params.amount;
  }
  if (params.transactionDate !== undefined) {
    if (Number.isNaN(new Date(params.transactionDate).getTime())) {
      throw new ValidationError("Transaction date is invalid.");
    }
    updates.transactionDate = params.transactionDate;
  }
  if (params.notes !== undefined) updates.notes = params.notes;

  await db
    .update(schema.ownerDrawings)
    .set(updates)
    .where(and(eq(schema.ownerDrawings.id, id), eq(schema.ownerDrawings.businessId, businessId)))
    .run();

  return getOwnedDrawingOrThrow(businessId, id);
}

export async function deleteOwnerDrawing(businessId: string, id: string): Promise<void> {
  await getOwnedDrawingOrThrow(businessId, id);
  await db
    .delete(schema.ownerDrawings)
    .where(and(eq(schema.ownerDrawings.id, id), eq(schema.ownerDrawings.businessId, businessId)))
    .run();
}
