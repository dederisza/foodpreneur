import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db, schema, sqlite } from "@/db/client";
import type { Sale, SaleItem } from "@/db/schema";
import { OwnershipError } from "@/modules/business/service";
import { getOwnedProductOrThrow } from "@/modules/catalog/products";
import { getApplicableSellingPrice } from "@/modules/pricing/service";
import { calculateCurrentHpp } from "@/modules/costing/hpp";

export class ValidationError extends Error {}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function generateTransactionNumber(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const short = randomUUID().slice(0, 6).toUpperCase();
  return `SALE-${y}${m}${d}-${short}`;
}

export type SaleWithItems = Sale & { items: SaleItem[] };

export type CreateSaleItemInput = {
  productId: string;
  quantity: number;
};

/**
 * THE SALE SNAPSHOT RULE (Phase 3, Section 6 — non-negotiable)
 * ---------------------------------------------------------------------------
 * For every line item, this function resolves the applicable selling
 * price and HPP *at the transaction date* (defaulting to now for a
 * same-day sale) and freezes them onto the sale_items row. Nothing about
 * a sale_item's `sellingPriceSnapshot`, `hppSnapshot`, `subtotal`, or
 * `totalHpp` is ever recalculated later — a subsequent price change,
 * recipe change, or ingredient cost change has zero effect on a sale
 * that has already been recorded. This is what makes historical
 * financial reporting reliable: it reads snapshots, never live product
 * state.
 *
 * TRANSACTIONAL SAFETY: all inserts (the sale row + every sale_item row)
 * are wrapped in a single SQLite transaction via BEGIN/COMMIT/ROLLBACK on
 * the shared connection, so a failure partway through (e.g. one product
 * turns out to have no valid HPP) leaves no partially created sale.
 *
 * NOTE ON CONCURRENCY: this Node process holds one shared SQLite
 * connection (see src/db/client.ts). BEGIN/COMMIT around a sequence of
 * `await` points is safe for the single-user, single-business-owner
 * scale this MVP targets, but would not correctly isolate two truly
 * concurrent sale creations against the same connection — a documented
 * limitation, not a silent risk (see README).
 * ------------------------------------------------------------------------ */
export async function createSale(params: {
  businessId: string;
  items: CreateSaleItemInput[];
  transactionDate?: string;
  paymentMethod?: string;
  notes?: string;
}): Promise<SaleWithItems> {
  if (!params.items || params.items.length === 0) {
    throw new ValidationError("A sale must contain at least one item.");
  }

  const transactionDate = params.transactionDate ?? new Date().toISOString();
  if (Number.isNaN(new Date(transactionDate).getTime())) {
    throw new ValidationError("Transaction date is invalid.");
  }

  // Resolve every line BEFORE opening the transaction, so validation
  // errors (bad product, no price, no HPP) never leave a half-open
  // transaction on the shared connection.
  const resolvedItems: {
    productId: string;
    productNameSnapshot: string;
    quantity: number;
    sellingPriceSnapshot: number;
    hppSnapshot: number;
    subtotal: number;
    totalHpp: number;
  }[] = [];

  for (const item of params.items) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new ValidationError("Every sale item quantity must be greater than zero.");
    }

    const product = await getOwnedProductOrThrow(params.businessId, item.productId);

    if (!product.isActive) {
      throw new ValidationError(
        `"${product.name}" is inactive and cannot be used in a new sale.`
      );
    }

    const applicablePrice = await getApplicableSellingPrice(
      params.businessId,
      item.productId,
      transactionDate
    );
    if (!applicablePrice) {
      throw new ValidationError(
        `"${product.name}" has no selling price set yet. Set a selling price before recording a sale.`
      );
    }

    const hpp = await calculateCurrentHpp(params.businessId, item.productId, transactionDate);
    if (hpp.status === "no_recipe") {
      throw new ValidationError(
        `"${product.name}" has no recipe yet, so its HPP cannot be captured for this sale.`
      );
    }
    if (hpp.status === "missing_cost_data") {
      throw new ValidationError(
        `"${product.name}" is missing cost data for: ${hpp.missingIngredientNames.join(", ")}. Fix ingredient costs before recording this sale.`
      );
    }

    const sellingPriceSnapshot = applicablePrice.sellingPrice;
    const hppSnapshot = hpp.totalCost;
    const subtotal = roundMoney(item.quantity * sellingPriceSnapshot);
    const totalHpp = roundMoney(item.quantity * hppSnapshot);

    resolvedItems.push({
      productId: item.productId,
      productNameSnapshot: product.name,
      quantity: item.quantity,
      sellingPriceSnapshot,
      hppSnapshot,
      subtotal,
      totalHpp,
    });
  }

  const totalAmount = roundMoney(resolvedItems.reduce((s, i) => s + i.subtotal, 0));
  const totalHppSum = roundMoney(resolvedItems.reduce((s, i) => s + i.totalHpp, 0));

  const saleId = randomUUID();
  const now = new Date().toISOString();
  const transactionNumber = generateTransactionNumber();

  sqlite.exec("BEGIN");
  try {
    await db
      .insert(schema.sales)
      .values({
        id: saleId,
        businessId: params.businessId,
        transactionDate,
        transactionNumber,
        totalAmount,
        totalHpp: totalHppSum,
        paymentMethod: params.paymentMethod,
        notes: params.notes,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      })
      .run();

    for (const item of resolvedItems) {
      await db
        .insert(schema.saleItems)
        .values({
          id: randomUUID(),
          saleId,
          businessId: params.businessId,
          productId: item.productId,
          productNameSnapshot: item.productNameSnapshot,
          quantity: item.quantity,
          sellingPriceSnapshot: item.sellingPriceSnapshot,
          hppSnapshot: item.hppSnapshot,
          subtotal: item.subtotal,
          totalHpp: item.totalHpp,
          createdAt: now,
        })
        .run();
    }
    sqlite.exec("COMMIT");
  } catch (err) {
    sqlite.exec("ROLLBACK");
    throw err;
  }

  return getOwnedSaleOrThrow(params.businessId, saleId);
}

export async function getOwnedSaleOrThrow(
  businessId: string,
  saleId: string
): Promise<SaleWithItems> {
  const sale = await db
    .select()
    .from(schema.sales)
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.businessId, businessId)))
    .get();

  if (!sale) {
    throw new OwnershipError("Sale not found or not owned by the current business.");
  }

  const items = await db
    .select()
    .from(schema.saleItems)
    .where(and(eq(schema.saleItems.saleId, saleId), eq(schema.saleItems.businessId, businessId)))
    .all();

  return { ...sale, items };
}

export async function listSales(
  businessId: string,
  range?: { from: string; to: string }
): Promise<Sale[]> {
  const rows = await db
    .select()
    .from(schema.sales)
    .where(eq(schema.sales.businessId, businessId))
    .all();

  const filtered = range
    ? rows.filter((s) => s.transactionDate >= range.from && s.transactionDate <= range.to)
    : rows;

  return filtered.sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
}

/**
 * EDIT/DELETE STRATEGY (Phase 3, Section 23 — Option C, voiding):
 * a finalized sale's financial fields are never edited or hard-deleted.
 * Voiding sets status = "voided" and leaves every snapshot value exactly
 * as recorded, for a full audit trail. Financial summaries exclude
 * voided sales from Revenue/COGS.
 */
export async function voidSale(businessId: string, saleId: string): Promise<Sale> {
  await getOwnedSaleOrThrow(businessId, saleId);

  await db
    .update(schema.sales)
    .set({ status: "voided", updatedAt: new Date().toISOString() })
    .where(and(eq(schema.sales.id, saleId), eq(schema.sales.businessId, businessId)))
    .run();

  const updated = await db
    .select()
    .from(schema.sales)
    .where(eq(schema.sales.id, saleId))
    .get();
  if (!updated) throw new Error("Failed to void sale.");
  return updated;
}
