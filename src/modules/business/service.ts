import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Business } from "@/db/schema";

export class OwnershipError extends Error {}

export async function listBusinessesForUser(userId: string): Promise<Business[]> {
  return db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.userId, userId))
    .all();
}

export async function createBusiness(params: {
  userId: string;
  businessName: string;
  businessType?: string | null;
  currency?: string;
}): Promise<Business> {
  const name = params.businessName.trim();
  if (!name) {
    throw new Error("Business name is required.");
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.businesses)
    .values({
      id,
      userId: params.userId,
      businessName: name,
      businessType: params.businessType ?? null,
      currency: params.currency ?? "IDR",
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = await db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, id))
    .get();

  if (!created) throw new Error("Failed to create business record.");
  return created;
}

/**
 * CRITICAL OWNERSHIP CHECK
 * ---------------------------------------------------------------------------
 * Every future module that reads or writes business-scoped data must go
 * through a function shaped like this — never trust a business_id coming
 * from the client (URL param, form field, cookie, etc.) without verifying
 * it belongs to the authenticated user first.
 *
 * Throws OwnershipError (rather than returning null) so callers cannot
 * accidentally treat "not owned" the same as "not found" and leak which
 * business IDs exist in the system versus which ones the user can access
 * — both cases should look identical to the caller.
 * ---------------------------------------------------------------------------
 */
export async function getOwnedBusinessOrThrow(
  userId: string,
  businessId: string
): Promise<Business> {
  const business = await db
    .select()
    .from(schema.businesses)
    .where(
      and(
        eq(schema.businesses.id, businessId),
        eq(schema.businesses.userId, userId)
      )
    )
    .get();

  if (!business) {
    throw new OwnershipError(
      "Business not found or not owned by the current user."
    );
  }

  return business;
}

export async function isBusinessOwnedByUser(
  userId: string,
  businessId: string
): Promise<boolean> {
  const business = await db
    .select({ id: schema.businesses.id })
    .from(schema.businesses)
    .where(
      and(
        eq(schema.businesses.id, businessId),
        eq(schema.businesses.userId, userId)
      )
    )
    .get();
  return Boolean(business);
}
