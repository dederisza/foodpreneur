import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Ingredient, IngredientCostHistory } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";
import { isValidBaseUnit } from "./units";

export class ValidationError extends Error {}

export async function listIngredients(
  businessId: string,
  options?: { includeInactive?: boolean }
): Promise<Ingredient[]> {
  const rows = await db
    .select()
    .from(schema.ingredients)
    .where(eq(schema.ingredients.businessId, businessId))
    .all();
  if (options?.includeInactive) return rows;
  return rows.filter((r) => r.isActive);
}

/**
 * CRITICAL OWNERSHIP CHECK — mirrors getOwnedBusinessOrThrow from Phase 1.
 * Every route/module that resolves an ingredient by id must go through
 * this function rather than querying schema.ingredients directly.
 */
export async function getOwnedIngredientOrThrow(
  businessId: string,
  ingredientId: string
): Promise<Ingredient> {
  const ingredient = await db
    .select()
    .from(schema.ingredients)
    .where(
      and(
        eq(schema.ingredients.id, ingredientId),
        eq(schema.ingredients.businessId, businessId)
      )
    )
    .get();

  if (!ingredient) {
    throw new OwnershipError(
      "Ingredient not found or not owned by the current business."
    );
  }
  return ingredient;
}

export async function createIngredient(params: {
  businessId: string;
  name: string;
  baseUnit: string;
  initialCost: number;
  notes?: string;
}): Promise<Ingredient> {
  const name = params.name.trim();
  if (!name) throw new ValidationError("Ingredient name is required.");
  if (!isValidBaseUnit(params.baseUnit)) {
    throw new ValidationError("Invalid base unit.");
  }
  if (!Number.isFinite(params.initialCost) || params.initialCost < 0) {
    throw new ValidationError("Cost must be a non-negative number.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.ingredients)
    .values({
      id,
      businessId: params.businessId,
      name,
      baseUnit: params.baseUnit,
      currentCost: params.initialCost,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  // Every ingredient always has at least one cost history row, created
  // atomically with the ingredient itself — see the note on `ingredients`
  // in schema.ts for why this invariant matters.
  await db
    .insert(schema.ingredientCostHistory)
    .values({
      id: randomUUID(),
      ingredientId: id,
      businessId: params.businessId,
      costPerBaseUnit: params.initialCost,
      effectiveFrom: now,
      notes: params.notes ?? "Initial cost",
      createdAt: now,
    })
    .run();

  const created = await getOwnedIngredientOrThrow(params.businessId, id);
  return created;
}

export async function updateIngredient(
  businessId: string,
  ingredientId: string,
  params: { name?: string; baseUnit?: string; isActive?: boolean }
): Promise<Ingredient> {
  await getOwnedIngredientOrThrow(businessId, ingredientId);

  const updates: Partial<typeof schema.ingredients.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (params.name !== undefined) {
    const name = params.name.trim();
    if (!name) throw new ValidationError("Ingredient name is required.");
    updates.name = name;
  }
  if (params.baseUnit !== undefined) {
    if (!isValidBaseUnit(params.baseUnit)) {
      throw new ValidationError("Invalid base unit.");
    }
    updates.baseUnit = params.baseUnit;
  }
  if (params.isActive !== undefined) {
    updates.isActive = params.isActive;
  }

  await db
    .update(schema.ingredients)
    .set(updates)
    .where(
      and(
        eq(schema.ingredients.id, ingredientId),
        eq(schema.ingredients.businessId, businessId)
      )
    )
    .run();

  return getOwnedIngredientOrThrow(businessId, ingredientId);
}

/**
 * Deactivation, not deletion — an ingredient may already be referenced by
 * recipes or (in later phases) historical transactions. See Phase 2
 * Section 23.
 */
export async function deactivateIngredient(
  businessId: string,
  ingredientId: string
): Promise<Ingredient> {
  return updateIngredient(businessId, ingredientId, { isActive: false });
}

/**
 * Records a cost change. Never mutates or removes prior cost history rows
 * — always inserts a new one. The ingredient's denormalized `currentCost`
 * is updated to match only when this new row is (or ties for) the most
 * recent `effectiveFrom` on file, so backdated corrections don't
 * incorrectly override a later-known cost.
 */
export async function changeIngredientCost(params: {
  businessId: string;
  ingredientId: string;
  costPerBaseUnit: number;
  effectiveFrom?: string;
  notes?: string;
}): Promise<IngredientCostHistory> {
  await getOwnedIngredientOrThrow(params.businessId, params.ingredientId);

  if (!Number.isFinite(params.costPerBaseUnit) || params.costPerBaseUnit < 0) {
    throw new ValidationError("Cost must be a non-negative number.");
  }

  const effectiveFrom = params.effectiveFrom ?? new Date().toISOString();
  if (Number.isNaN(new Date(effectiveFrom).getTime())) {
    throw new ValidationError("Effective date is invalid.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.ingredientCostHistory)
    .values({
      id,
      ingredientId: params.ingredientId,
      businessId: params.businessId,
      costPerBaseUnit: params.costPerBaseUnit,
      effectiveFrom,
      notes: params.notes,
      createdAt: now,
    })
    .run();

  // Recompute the denormalized "current" cost from the actual latest
  // history row, rather than assuming the row we just inserted is it —
  // this keeps behavior correct even for backdated/out-of-order entries.
  const latest = await getApplicableIngredientCost(
    params.businessId,
    params.ingredientId,
    new Date().toISOString()
  );
  if (latest) {
    await db
      .update(schema.ingredients)
      .set({ currentCost: latest.costPerBaseUnit, updatedAt: now })
      .where(eq(schema.ingredients.id, params.ingredientId))
      .run();
  }

  const created = await db
    .select()
    .from(schema.ingredientCostHistory)
    .where(eq(schema.ingredientCostHistory.id, id))
    .get();
  if (!created) throw new Error("Failed to create cost history record.");
  return created;
}

export async function listIngredientCostHistory(
  businessId: string,
  ingredientId: string
): Promise<IngredientCostHistory[]> {
  await getOwnedIngredientOrThrow(businessId, ingredientId);
  const rows = await db
    .select()
    .from(schema.ingredientCostHistory)
    .where(
      and(
        eq(schema.ingredientCostHistory.ingredientId, ingredientId),
        eq(schema.ingredientCostHistory.businessId, businessId)
      )
    )
    .all();
  return rows.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
}

/**
 * DETERMINISTIC APPLICABLE-COST RULE (Phase 2, Section 7):
 * the cost history row with the latest `effective_from` that is <= the
 * target date, ties broken by `created_at` DESC. Returns null if the
 * ingredient has no cost history at or before the target date at all
 * (should not normally happen, since every ingredient gets an initial
 * history row at creation — but callers must handle it rather than
 * assume a cost always exists, per Section 21's HPP validation rules).
 */
export async function getApplicableIngredientCost(
  businessId: string,
  ingredientId: string,
  targetDateIso: string
): Promise<IngredientCostHistory | null> {
  const rows = await db
    .select()
    .from(schema.ingredientCostHistory)
    .where(
      and(
        eq(schema.ingredientCostHistory.ingredientId, ingredientId),
        eq(schema.ingredientCostHistory.businessId, businessId)
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
