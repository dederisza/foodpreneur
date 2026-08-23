import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { ProductRecipe } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";
import { getOwnedProductOrThrow } from "./products";
import { getOwnedIngredientOrThrow } from "./ingredients";
import { ValidationError } from "./ingredients";

export type RecipeLine = ProductRecipe & {
  ingredientName: string;
  ingredientBaseUnit: string;
};

export async function listRecipeForProduct(
  businessId: string,
  productId: string
): Promise<RecipeLine[]> {
  await getOwnedProductOrThrow(businessId, productId);

  const rows = await db
    .select({
      id: schema.productRecipes.id,
      productId: schema.productRecipes.productId,
      ingredientId: schema.productRecipes.ingredientId,
      businessId: schema.productRecipes.businessId,
      quantity: schema.productRecipes.quantity,
      createdAt: schema.productRecipes.createdAt,
      updatedAt: schema.productRecipes.updatedAt,
      ingredientName: schema.ingredients.name,
      ingredientBaseUnit: schema.ingredients.baseUnit,
    })
    .from(schema.productRecipes)
    .innerJoin(
      schema.ingredients,
      eq(schema.productRecipes.ingredientId, schema.ingredients.id)
    )
    .where(
      and(
        eq(schema.productRecipes.productId, productId),
        eq(schema.productRecipes.businessId, businessId)
      )
    )
    .all();

  return rows;
}

/**
 * CROSS-BUSINESS PROTECTION (Phase 2, Section 9 & 26):
 * both the product and the ingredient are independently resolved through
 * their own ownership-checked lookups before a recipe row is created —
 * this makes it impossible to attach Business B's ingredient to Business
 * A's product even in the hypothetical case where a spoofed business_id
 * were accepted on the request body, since both underlying lookups are
 * scoped to the caller's own (server-resolved) businessId.
 */
export async function addRecipeItem(params: {
  businessId: string;
  productId: string;
  ingredientId: string;
  quantity: number;
}): Promise<ProductRecipe> {
  await getOwnedProductOrThrow(params.businessId, params.productId);
  await getOwnedIngredientOrThrow(params.businessId, params.ingredientId);

  if (!Number.isFinite(params.quantity) || params.quantity <= 0) {
    throw new ValidationError("Quantity must be greater than zero.");
  }

  const existing = await db
    .select()
    .from(schema.productRecipes)
    .where(
      and(
        eq(schema.productRecipes.productId, params.productId),
        eq(schema.productRecipes.ingredientId, params.ingredientId),
        eq(schema.productRecipes.businessId, params.businessId)
      )
    )
    .get();
  if (existing) {
    throw new ValidationError(
      "This ingredient is already in the recipe. Edit its quantity instead of adding it again."
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.productRecipes)
    .values({
      id,
      productId: params.productId,
      ingredientId: params.ingredientId,
      businessId: params.businessId,
      quantity: params.quantity,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = await db
    .select()
    .from(schema.productRecipes)
    .where(eq(schema.productRecipes.id, id))
    .get();
  if (!created) throw new Error("Failed to create recipe item.");
  return created;
}

export async function updateRecipeItemQuantity(params: {
  businessId: string;
  productId: string;
  recipeItemId: string;
  quantity: number;
}): Promise<ProductRecipe> {
  await getOwnedProductOrThrow(params.businessId, params.productId);

  if (!Number.isFinite(params.quantity) || params.quantity <= 0) {
    throw new ValidationError("Quantity must be greater than zero.");
  }

  const item = await db
    .select()
    .from(schema.productRecipes)
    .where(
      and(
        eq(schema.productRecipes.id, params.recipeItemId),
        eq(schema.productRecipes.productId, params.productId),
        eq(schema.productRecipes.businessId, params.businessId)
      )
    )
    .get();
  if (!item) {
    throw new OwnershipError(
      "Recipe item not found or not owned by the current business."
    );
  }

  await db
    .update(schema.productRecipes)
    .set({ quantity: params.quantity, updatedAt: new Date().toISOString() })
    .where(eq(schema.productRecipes.id, params.recipeItemId))
    .run();

  const updated = await db
    .select()
    .from(schema.productRecipes)
    .where(eq(schema.productRecipes.id, params.recipeItemId))
    .get();
  if (!updated) throw new Error("Failed to update recipe item.");
  return updated;
}

export async function removeRecipeItem(params: {
  businessId: string;
  productId: string;
  recipeItemId: string;
}): Promise<void> {
  await getOwnedProductOrThrow(params.businessId, params.productId);

  const item = await db
    .select()
    .from(schema.productRecipes)
    .where(
      and(
        eq(schema.productRecipes.id, params.recipeItemId),
        eq(schema.productRecipes.productId, params.productId),
        eq(schema.productRecipes.businessId, params.businessId)
      )
    )
    .get();
  if (!item) {
    throw new OwnershipError(
      "Recipe item not found or not owned by the current business."
    );
  }

  await db
    .delete(schema.productRecipes)
    .where(eq(schema.productRecipes.id, params.recipeItemId))
    .run();
}
