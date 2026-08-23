import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { ProductCostVersion } from "@/db/schema";
import { calculateCurrentHpp, type HppResult } from "./hpp";

/**
 * RECALCULATION STRATEGY (Phase 2, Section 20)
 * ---------------------------------------------------------------------------
 * Chosen approach: EXPLICIT, IMMEDIATE recalculation triggered by the
 * mutations that can actually change a product's HPP — not a background
 * job, not a scheduled recompute. The triggers are:
 *   1. A recipe item is added, changed, or removed for a product.
 *   2. An ingredient's cost changes (recalculated for every product that
 *      uses that ingredient — see recalculateForIngredient below).
 *   3. A manual "recalculate" action on the product detail page.
 * This was chosen over a background job because Phase 2 is an MVP: the
 * data volumes involved (one business's own products/ingredients) are
 * small enough that synchronous recalculation on the actual mutation is
 * both simpler to reason about and fast enough not to need async
 * infrastructure.
 *
 * DEDUPE RULE (Phase 2, Section 14): a new product_cost_versions row is
 * only created when the calculated total actually differs from the most
 * recent existing version for that product (compared with a small
 * floating-point tolerance, since HPP is a monetary sum of multiplied
 * decimals). If nothing changed the number, no duplicate version is
 * written — the existing version remains the current one.
 * ------------------------------------------------------------------------ */

const FLOAT_TOLERANCE = 0.0001;

export type CostVersionOutcome =
  | { created: true; version: ProductCostVersion }
  | { created: false; reason: "unchanged" | "no_recipe" | "missing_cost_data" };

async function getLatestCostVersion(
  businessId: string,
  productId: string
): Promise<ProductCostVersion | null> {
  const rows = await db
    .select()
    .from(schema.productCostVersions)
    .where(
      and(
        eq(schema.productCostVersions.productId, productId),
        eq(schema.productCostVersions.businessId, businessId)
      )
    )
    .all();
  if (rows.length === 0) return null;
  rows.sort((a, b) => {
    const byEffective = b.effectiveFrom.localeCompare(a.effectiveFrom);
    if (byEffective !== 0) return byEffective;
    return b.createdAt.localeCompare(a.createdAt);
  });
  return rows[0];
}

/**
 * Recalculates HPP for a single product and, if the result materially
 * differs from the latest existing version, inserts a new
 * product_cost_versions row and updates the product's denormalized
 * `currentHpp`. Never overwrites or deletes a prior version — see the
 * historical-integrity note on the schema.
 */
export async function recalculateProductCostVersion(
  businessId: string,
  productId: string
): Promise<CostVersionOutcome> {
  const result: HppResult = await calculateCurrentHpp(businessId, productId);

  if (result.status === "no_recipe") {
    return { created: false, reason: "no_recipe" };
  }
  if (result.status === "missing_cost_data") {
    return { created: false, reason: "missing_cost_data" };
  }

  const calculationBasis = JSON.stringify({
    lineItems: result.lineItems,
    totalCost: result.totalCost,
  });

  const latest = await getLatestCostVersion(businessId, productId);
  const unchanged =
    latest !== null &&
    Math.abs(latest.totalCost - result.totalCost) < FLOAT_TOLERANCE &&
    latest.calculationBasis === calculationBasis;

  if (unchanged) {
    return { created: false, reason: "unchanged" };
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.productCostVersions)
    .values({
      id,
      businessId,
      productId,
      totalCost: result.totalCost,
      calculationBasis,
      effectiveFrom: now,
      createdAt: now,
    })
    .run();

  await db
    .update(schema.products)
    .set({ currentHpp: result.totalCost, updatedAt: now })
    .where(eq(schema.products.id, productId))
    .run();

  const created = await db
    .select()
    .from(schema.productCostVersions)
    .where(eq(schema.productCostVersions.id, id))
    .get();
  if (!created) throw new Error("Failed to create product cost version.");

  return { created: true, version: created };
}

/**
 * Called after an ingredient's cost changes: finds every product (within
 * the same business) whose recipe references that ingredient and
 * recalculates each one. This is how "ingredient cost change → new HPP
 * version" (Phase 2, Section 14) is actually wired up, rather than
 * relying on someone remembering to call recalculate per-product.
 */
export async function recalculateProductsUsingIngredient(
  businessId: string,
  ingredientId: string
): Promise<void> {
  const affected = await db
    .select({ productId: schema.productRecipes.productId })
    .from(schema.productRecipes)
    .where(
      and(
        eq(schema.productRecipes.ingredientId, ingredientId),
        eq(schema.productRecipes.businessId, businessId)
      )
    )
    .all();

  const uniqueProductIds = Array.from(new Set(affected.map((r) => r.productId)));
  for (const productId of uniqueProductIds) {
    await recalculateProductCostVersion(businessId, productId);
  }
}

export async function listCostVersionHistory(
  businessId: string,
  productId: string
): Promise<ProductCostVersion[]> {
  const rows = await db
    .select()
    .from(schema.productCostVersions)
    .where(
      and(
        eq(schema.productCostVersions.productId, productId),
        eq(schema.productCostVersions.businessId, businessId)
      )
    )
    .all();
  return rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}
