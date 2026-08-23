import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Product } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";
import { ValidationError } from "./ingredients";

export async function listProducts(
  businessId: string,
  options?: { includeInactive?: boolean }
): Promise<Product[]> {
  const rows = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.businessId, businessId))
    .all();
  if (options?.includeInactive) return rows;
  return rows.filter((r) => r.isActive);
}

/**
 * CRITICAL OWNERSHIP CHECK — same pattern as getOwnedBusinessOrThrow /
 * getOwnedIngredientOrThrow. Every route/module resolving a product by id
 * must go through this function.
 */
export async function getOwnedProductOrThrow(
  businessId: string,
  productId: string
): Promise<Product> {
  const product = await db
    .select()
    .from(schema.products)
    .where(
      and(
        eq(schema.products.id, productId),
        eq(schema.products.businessId, businessId)
      )
    )
    .get();

  if (!product) {
    throw new OwnershipError(
      "Product not found or not owned by the current business."
    );
  }
  return product;
}

export async function createProduct(params: {
  businessId: string;
  name: string;
  description?: string;
  category?: string;
}): Promise<Product> {
  const name = params.name.trim();
  if (!name) throw new ValidationError("Product name is required.");

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.products)
    .values({
      id,
      businessId: params.businessId,
      name,
      description: params.description?.trim() || null,
      category: params.category?.trim() || null,
      currentSellingPrice: null,
      currentHpp: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return getOwnedProductOrThrow(params.businessId, id);
}

export async function updateProduct(
  businessId: string,
  productId: string,
  params: {
    name?: string;
    description?: string | null;
    category?: string | null;
    isActive?: boolean;
  }
): Promise<Product> {
  await getOwnedProductOrThrow(businessId, productId);

  const updates: Partial<typeof schema.products.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };

  if (params.name !== undefined) {
    const name = params.name.trim();
    if (!name) throw new ValidationError("Product name is required.");
    updates.name = name;
  }
  if (params.description !== undefined) {
    updates.description = params.description?.trim() || null;
  }
  if (params.category !== undefined) {
    updates.category = params.category?.trim() || null;
  }
  if (params.isActive !== undefined) {
    updates.isActive = params.isActive;
  }

  await db
    .update(schema.products)
    .set(updates)
    .where(
      and(
        eq(schema.products.id, productId),
        eq(schema.products.businessId, businessId)
      )
    )
    .run();

  return getOwnedProductOrThrow(businessId, productId);
}

/** Deactivation, not deletion — see Phase 2 Section 23. */
export async function deactivateProduct(
  businessId: string,
  productId: string
): Promise<Product> {
  return updateProduct(businessId, productId, { isActive: false });
}
