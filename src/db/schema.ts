/**
 * CORE DATABASE SCHEMA
 * ---------------------------------------------------------------------------
 * This file defines the full logical schema described in the Master Project
 * Context (20 logical tables across 6 domains). For PHASE 1 we only activate
 * the tables required for authentication, business identity, and ownership.
 *
 * Approach chosen: OPTION B (from Phase 1 instructions, Section 11).
 *   - Only the foundational tables (users, businesses) are created now.
 *   - Every future table is added via a NEW migration in a LATER phase.
 *   - This keeps the schema honest: nothing exists in the DB that isn't
 *     backed by real, working application logic yet.
 *
 * Rationale: with Drizzle's migration system, adding tables later is a
 * cheap, safe, reviewable diff. Pre-creating all 20 tables now (Option A)
 * would let future phases silently assume schema details that were never
 * validated against real business logic, and would make Phase 1's diff
 * misleading about what was actually implemented.
 *
 * When future phases are implemented, new tables must be added here AND
 * a new Drizzle migration must be generated. Do not hand-edit the SQL
 * migration files.
 * ---------------------------------------------------------------------------
 */

import {
  sqliteTable,
  text,
  real,
  integer,
  index,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * USERS
 * Application-level identity. Authentication credentials live here for
 * Phase 1 because the project is not using a third-party auth platform.
 * If a platform-native auth table becomes available in a later hosting
 * environment, this table should be adapted to reference it rather than
 * duplicating credential storage.
 */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // uuid, generated in application code
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(CURRENT_TIMESTAMP)`),
});

/**
 * BUSINESSES
 * Ownership boundary root. Every future business-related table must carry
 * a business_id foreign key pointing here. A user may own multiple
 * businesses (one-to-many), never the reverse.
 */
export const businesses = sqliteTable(
  "businesses",
  {
    id: text("id").primaryKey(), // uuid
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    businessType: text("business_type"), // e.g. "street_food", "fast_food", "other"
    currency: text("currency").notNull().default("IDR"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("businesses_user_id_idx").on(table.userId)]
);

/**
 * SESSIONS
 * Server-side session record backing the signed session cookie. Storing a
 * session row (rather than a pure stateless JWT) lets us support logout /
 * invalidation cleanly, which a stateless-only JWT cannot do safely.
 */
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // uuid, also embedded in the signed cookie
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    activeBusinessId: text("active_business_id"), // nullable, validated on every read
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    expiresAt: text("expires_at").notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)]
);

/* ---------------------------------------------------------------------------
 * PHASE 2 — CATALOG, COSTING, AND PRICING
 * ---------------------------------------------------------------------------
 * All six tables below are scoped to a business via `business_id` (either
 * directly or, for product_recipes, through both the product and the
 * ingredient it references — see the ownership note on that table).
 *
 * Historical integrity strategy (applies to ingredient costs, HPP, and
 * selling prices alike): the "current" value on the parent row
 * (ingredients.current_cost, products.currentSellingPrice,
 * products.currentHpp) is a denormalized convenience read — the source of
 * truth for "what was true at time X" always lives in the corresponding
 * *_history / *_versions table. Nothing here ever overwrites a past row;
 * changes always insert a new row with its own effective_from.
 * ------------------------------------------------------------------------ */

/**
 * INGREDIENTS
 * `currentCost` is a denormalized read of the latest ingredient_cost_history
 * row for this ingredient — see ingredient_cost_history below. Every
 * ingredient always has at least one cost history row (created at the same
 * time as the ingredient itself), so there is never a "current cost with no
 * history to back it" state.
 */
export const ingredients = sqliteTable(
  "ingredients",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    baseUnit: text("base_unit").notNull(), // e.g. "gram", "ml", "piece" — see BASE_UNITS in modules/catalog
    currentCost: real("current_cost").notNull(), // denormalized: latest ingredient_cost_history.costPerBaseUnit
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("ingredients_business_id_idx").on(table.businessId)]
);

/**
 * INGREDIENT_COST_HISTORY
 * Append-only. A new row is inserted every time an ingredient's cost
 * changes (including the initial cost at creation time). Never updated or
 * deleted. The applicable cost at any point in time is resolved as: the
 * row with the latest `effective_from` that is <= the target date, ties
 * broken by `created_at` DESC (see modules/costing/hpp.ts).
 */
export const ingredientCostHistory = sqliteTable(
  "ingredient_cost_history",
  {
    id: text("id").primaryKey(),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    costPerBaseUnit: real("cost_per_base_unit").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("ingredient_cost_history_ingredient_id_idx").on(table.ingredientId),
    index("ingredient_cost_history_business_id_idx").on(table.businessId),
    index("ingredient_cost_history_effective_from_idx").on(table.effectiveFrom),
  ]
);

/**
 * PRODUCTS
 * `currentSellingPrice` and `currentHpp` are denormalized reads of the
 * latest selling_price_history / product_cost_versions rows respectively.
 * `currentHpp` is nullable because a brand-new product with no recipe yet
 * has no meaningful HPP — see modules/costing for how that state is
 * surfaced rather than silently shown as 0.
 */
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    category: text("category"),
    currentSellingPrice: real("current_selling_price"), // denormalized: latest selling_price_history.sellingPrice
    currentHpp: real("current_hpp"), // denormalized: latest product_cost_versions.totalCost
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [index("products_business_id_idx").on(table.businessId)]
);

/**
 * PRODUCT_RECIPES
 * One row per ingredient used in a product. `quantity` is always expressed
 * in the referenced ingredient's own `baseUnit` — there is no unit
 * conversion engine in this phase (see modules/catalog/recipes.ts).
 *
 * OWNERSHIP NOTE: this table carries its own `business_id` for simple,
 * direct scoping, but that alone is not suffient — the service layer
 * (modules/catalog/recipes.ts) additionally verifies that BOTH the
 * product and the ingredient referenced belong to that same business
 * before a recipe row can be created. This makes a cross-business recipe
 * (e.g. Business A's product using Business B's ingredient) impossible
 * even if a business_id were somehow spoofed on the request.
 */
export const productRecipes = sqliteTable(
  "product_recipes",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    ingredientId: text("ingredient_id")
      .notNull()
      .references(() => ingredients.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    quantity: real("quantity").notNull(), // in the ingredient's base_unit
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("product_recipes_product_id_idx").on(table.productId),
    index("product_recipes_ingredient_id_idx").on(table.ingredientId),
    index("product_recipes_business_id_idx").on(table.businessId),
  ]
);

/**
 * PRODUCT_COST_VERSIONS
 * Append-only historical HPP snapshots. `calculationBasis` stores a JSON
 * string (SQLite has no native JSON column) capturing exactly which recipe
 * quantities and ingredient costs produced `totalCost`, so a past HPP can
 * always be explained without recalculating against today's ingredient
 * prices. See modules/costing/hpp.ts for the shape and
 * modules/costing/service.ts for the dedupe rule that decides when a new
 * version is actually worth creating.
 */
export const productCostVersions = sqliteTable(
  "product_cost_versions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    totalCost: real("total_cost").notNull(),
    calculationBasis: text("calculation_basis").notNull(), // JSON string, see HppBreakdown type
    effectiveFrom: text("effective_from").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("product_cost_versions_product_id_idx").on(table.productId),
    index("product_cost_versions_business_id_idx").on(table.businessId),
    index("product_cost_versions_effective_from_idx").on(table.effectiveFrom),
  ]
);

/**
 * SELLING_PRICE_HISTORY
 * Append-only, mirrors ingredient_cost_history's pattern exactly. Applicable
 * price at any point in time is resolved the same way (latest
 * effective_from <= target, tie-broken by created_at DESC).
 */
export const sellingPriceHistory = sqliteTable(
  "selling_price_history",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sellingPrice: real("selling_price").notNull(),
    effectiveFrom: text("effective_from").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("selling_price_history_product_id_idx").on(table.productId),
    index("selling_price_history_business_id_idx").on(table.businessId),
    index("selling_price_history_effective_from_idx").on(table.effectiveFrom),
  ]
);

/* ---------------------------------------------------------------------------
 * PHASE 3 — SALES, EXPENSES, CAPITAL, OWNER DRAWINGS
 * ---------------------------------------------------------------------------
 * The single most important rule in this section: a sale_item is a
 * historical financial record, not a live reference to a product. It
 * captures its own snapshot of the selling price and HPP *at the moment
 * of sale* — sellingPriceSnapshot / hppSnapshot / subtotal / totalHpp are
 * never recalculated from current product/ingredient data. A later price
 * change, recipe change, or ingredient cost change must not alter the
 * financial meaning of a sale that already happened. See
 * modules/sales/service.ts for where the snapshot is actually taken.
 * ------------------------------------------------------------------------ */

/**
 * SALES
 * `status` supports the Phase 3 edit/delete strategy (Option C — void,
 * don't edit or hard-delete): a finalized sale's financial numbers are
 * never mutated in place. If a sale was recorded in error, it is voided
 * (status = "voided") rather than edited or deleted, preserving a full
 * audit trail and never creating orphaned sale_items. Financial summary
 * queries exclude voided sales.
 */
export const sales = sqliteTable(
  "sales",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    transactionDate: text("transaction_date").notNull(),
    transactionNumber: text("transaction_number").notNull(),
    totalAmount: real("total_amount").notNull(), // denormalized SUM(sale_items.subtotal)
    totalHpp: real("total_hpp").notNull(), // denormalized SUM(sale_items.total_hpp)
    paymentMethod: text("payment_method"),
    notes: text("notes"),
    status: text("status", { enum: ["completed", "voided"] })
      .notNull()
      .default("completed"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("sales_business_id_idx").on(table.businessId),
    index("sales_transaction_date_idx").on(table.transactionDate),
  ]
);

/**
 * SALE_ITEMS
 * The historical snapshot itself. `productId` is kept (for linking back
 * to the still-active product record where useful) but every financial
 * figure below is frozen at creation time and must never be
 * recalculated from `productId`'s current state:
 *   - productNameSnapshot: the product's name at time of sale
 *   - sellingPriceSnapshot: the applicable selling price at time of sale
 *   - hppSnapshot: the applicable HPP (per unit) at time of sale
 *   - subtotal: quantity * sellingPriceSnapshot
 *   - totalHpp: quantity * hppSnapshot
 */
export const saleItems = sqliteTable(
  "sale_items",
  {
    id: text("id").primaryKey(),
    saleId: text("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    productNameSnapshot: text("product_name_snapshot").notNull(),
    quantity: real("quantity").notNull(),
    sellingPriceSnapshot: real("selling_price_snapshot").notNull(),
    hppSnapshot: real("hpp_snapshot").notNull(),
    subtotal: real("subtotal").notNull(),
    totalHpp: real("total_hpp").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("sale_items_sale_id_idx").on(table.saleId),
    index("sale_items_business_id_idx").on(table.businessId),
    index("sale_items_product_id_idx").on(table.productId),
  ]
);

/**
 * EXPENSES
 * Not a historical-snapshot table like sale_items — an expense record
 * has no downstream record that depends on its point-in-time value, so
 * (unlike sales) it is safe to edit or delete in place. See Section 19
 * of the Phase 3 instructions and modules/finance/expenses.ts.
 */
export const expenses = sqliteTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    transactionDate: text("transaction_date").notNull(),
    amount: real("amount").notNull(),
    category: text("category").notNull(), // see EXPENSE_CATEGORIES in modules/finance/expenses.ts
    description: text("description"),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("expenses_business_id_idx").on(table.businessId),
    index("expenses_transaction_date_idx").on(table.transactionDate),
  ]
);

/**
 * CAPITAL_TRANSACTIONS
 * Money injected into the business — NEVER counted as revenue (Master
 * Prompt Section 7, Phase 3 Section 12/15). Editable/deletable in place,
 * same reasoning as expenses.
 */
export const capitalTransactions = sqliteTable(
  "capital_transactions",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    transactionDate: text("transaction_date").notNull(),
    amount: real("amount").notNull(),
    source: text("source"), // e.g. "owner capital", "investor capital"
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("capital_transactions_business_id_idx").on(table.businessId),
    index("capital_transactions_transaction_date_idx").on(table.transactionDate),
  ]
);

/**
 * OWNER_DRAWINGS
 * Money taken out of the business by the owner — NEVER counted as an
 * operating expense (Master Prompt Section 7, Phase 3 Section 13/15).
 * Editable/deletable in place, same reasoning as expenses.
 */
export const ownerDrawings = sqliteTable(
  "owner_drawings",
  {
    id: text("id").primaryKey(),
    businessId: text("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    transactionDate: text("transaction_date").notNull(),
    amount: real("amount").notNull(),
    notes: text("notes"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(CURRENT_TIMESTAMP)`),
  },
  (table) => [
    index("owner_drawings_business_id_idx").on(table.businessId),
    index("owner_drawings_transaction_date_idx").on(table.transactionDate),
  ]
);

/* ---------------------------------------------------------------------------
 * FUTURE TABLES (NOT YET CREATED IN THIS PHASE)
 * ---------------------------------------------------------------------------
 * Documented here only as a semantic reference for future phases. Do not
 * import or use these — they do not exist in the database yet.
 *
 * Business Planning & Goals:
 *   business_plans, business_goals
 * Intelligence Layer:
 *   business_metrics, business_diagnostics, business_health_scores,
 *   priority_actions, ai_analyses
 * ------------------------------------------------------------------------ */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Ingredient = typeof ingredients.$inferSelect;
export type NewIngredient = typeof ingredients.$inferInsert;
export type IngredientCostHistory = typeof ingredientCostHistory.$inferSelect;
export type NewIngredientCostHistory = typeof ingredientCostHistory.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type ProductRecipe = typeof productRecipes.$inferSelect;
export type NewProductRecipe = typeof productRecipes.$inferInsert;
export type ProductCostVersion = typeof productCostVersions.$inferSelect;
export type NewProductCostVersion = typeof productCostVersions.$inferInsert;
export type SellingPriceHistory = typeof sellingPriceHistory.$inferSelect;
export type NewSellingPriceHistory = typeof sellingPriceHistory.$inferInsert;
export type Sale = typeof sales.$inferSelect;
export type NewSale = typeof sales.$inferInsert;
export type SaleItem = typeof saleItems.$inferSelect;
export type NewSaleItem = typeof saleItems.$inferInsert;
export type Expense = typeof expenses.$inferSelect;
export type NewExpense = typeof expenses.$inferInsert;
export type CapitalTransaction = typeof capitalTransactions.$inferSelect;
export type NewCapitalTransaction = typeof capitalTransactions.$inferInsert;
export type OwnerDrawing = typeof ownerDrawings.$inferSelect;
export type NewOwnerDrawing = typeof ownerDrawings.$inferInsert;
