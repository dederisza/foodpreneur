import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { SellingPriceHistory } from "@/db/schema";
import { getOwnedProductOrThrow } from "@/modules/catalog/products";
import { ValidationError } from "@/modules/catalog/ingredients";

/**
 * Records a selling price change. Mirrors ingredient cost history exactly
 * (Phase 2, Section 16-17): never overwrites a prior price row, always
 * inserts a new one, and recomputes the product's denormalized
 * `currentSellingPrice` from the actual latest applicable row afterward
 * rather than assuming the new row is automatically "current" (so
 * backdated corrections behave correctly).
 */
export async function changeSellingPrice(params: {
  businessId: string;
  productId: string;
  sellingPrice: number;
  effectiveFrom?: string;
  notes?: string;
}): Promise<SellingPriceHistory> {
  await getOwnedProductOrThrow(params.businessId, params.productId);

  if (!Number.isFinite(params.sellingPrice) || params.sellingPrice < 0) {
    throw new ValidationError("Selling price must be a non-negative number.");
  }

  const effectiveFrom = params.effectiveFrom ?? new Date().toISOString();
  if (Number.isNaN(new Date(effectiveFrom).getTime())) {
    throw new ValidationError("Effective date is invalid.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.sellingPriceHistory)
    .values({
      id,
      businessId: params.businessId,
      productId: params.productId,
      sellingPrice: params.sellingPrice,
      effectiveFrom,
      notes: params.notes,
      createdAt: now,
    })
    .run();

  const latest = await getApplicableSellingPrice(
    params.businessId,
    params.productId,
    new Date().toISOString()
  );
  if (latest) {
    await db
      .update(schema.products)
      .set({ currentSellingPrice: latest.sellingPrice, updatedAt: now })
      .where(eq(schema.products.id, params.productId))
      .run();
  }

  const created = await db
    .select()
    .from(schema.sellingPriceHistory)
    .where(eq(schema.sellingPriceHistory.id, id))
    .get();
  if (!created) throw new Error("Failed to create selling price record.");
  return created;
}

export async function listSellingPriceHistory(
  businessId: string,
  productId: string
): Promise<SellingPriceHistory[]> {
  await getOwnedProductOrThrow(businessId, productId);
  const rows = await db
    .select()
    .from(schema.sellingPriceHistory)
    .where(
      and(
        eq(schema.sellingPriceHistory.productId, productId),
        eq(schema.sellingPriceHistory.businessId, businessId)
      )
    )
    .all();
  return rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

/** Same deterministic rule as getApplicableIngredientCost (Phase 2, Section 7). */
export async function getApplicableSellingPrice(
  businessId: string,
  productId: string,
  targetDateIso: string
): Promise<SellingPriceHistory | null> {
  const rows = await db
    .select()
    .from(schema.sellingPriceHistory)
    .where(
      and(
        eq(schema.sellingPriceHistory.productId, productId),
        eq(schema.sellingPriceHistory.businessId, businessId)
      )
    )
    .all();

  const applicable = rows.filter((r) => r.effectiveFrom <= targetDateIso);
  if (applicable.length === 0) return null;

  applicable.sort((a, b) => {
    const byEffective = b.effectiveFrom.localeCompare(a.effectiveFrom);
    if (byEffective !== 0) return byEffective;
    return b.createdAt.localeCompare(a.createdAt);
  });

  return applicable[0];
}
