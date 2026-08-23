/**
 * Seed script for local development / demo purposes only.
 *
 * Creates:
 *   - one demo user (demo@foodpreneur.local / password: demo12345)
 *   - one demo business owned by that user, backdated to 3 calendar
 *     months ago (Phase 6) so the Intelligence Engine (Phase 4) and AI
 *     Synthesis (Phase 5) have a genuine previous-period baseline to
 *     compare against, instead of always reporting insufficient
 *     historical data
 *   - Phase 2 demo catalog: a few ingredients (with cost history), two
 *     products with recipes, HPP versions, and selling price history
 *   - Phase 3 demo activity: a previous-month sale, a same-day
 *     historical-integrity sale, a current multi-product sale,
 *     expenses, capital, and an owner drawing
 *
 * This demo data is deliberately real, not fabricated: every row is
 * created through the actual Phase 1-3 service functions (createSale,
 * changeIngredientCost, changeSellingPrice, etc.) with explicit
 * `transactionDate`/`effectiveFrom` overrides where a row needs to be
 * backdated - never inserted as a raw row bypassing business logic
 * (except for the user/business rows themselves, which have no service
 * function of their own to call). Phase 4 findings, Phase 5 AI
 * synthesis, and this reporting page all then derive their output from
 * this real data - nothing about intelligence, synthesis, or reports is
 * ever pre-baked or faked.
 *
 * Safe to re-run: it skips creation entirely if the demo user already
 * exists (no duplicate demo users/businesses/catalog data are ever
 * created).
 *
 * Run with: npm run db:seed
 *
 * NOTE: this script imports the real Phase 2/3 service functions
 * (createIngredient, changeIngredientCost, createProduct, addRecipeItem,
 * recalculateProductCostVersion, changeSellingPrice, createSale,
 * createExpense, createCapitalTransaction, createOwnerDrawing) rather
 * than inserting rows directly — this means the seed data is guaranteed
 * to be produced through the exact same code path the running app uses,
 * so it can't drift out of sync with real application behavior.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema, sqlite } from "./client";
import { createIngredient, changeIngredientCost } from "@/modules/catalog/ingredients";
import { createProduct } from "@/modules/catalog/products";
import { addRecipeItem } from "@/modules/catalog/recipes";
import { recalculateProductCostVersion } from "@/modules/costing/service";
import { changeSellingPrice } from "@/modules/pricing/service";
import { createSale } from "@/modules/sales/service";
import { createExpense } from "@/modules/finance/expenses";
import { createCapitalTransaction } from "@/modules/finance/capital";
import { createOwnerDrawing } from "@/modules/finance/drawings";

const DEMO_EMAIL = "demo@foodpreneur.local";
const DEMO_PASSWORD = "demo12345";

/**
 * PHASE 6 DEMO STORY TIMELINE
 * ---------------------------------------------------------------------------
 * The business is backdated to have existed since well before "last
 * month" so the Intelligence Engine's period-over-period comparison
 * (Phase 4) has a genuine previous-period baseline to compare against,
 * instead of always reporting "insufficient historical data" (which was
 * the case whenever the demo business was created "today", as it is on
 * every dev run). This lets the demo show a real, non-fabricated
 * sales-growth finding and a real AI Synthesis + START flow driven by
 * actual comparison data — exactly the Phase 4/5 pipeline this app
 * exists to demonstrate — without inventing any numbers: every
 * historical row below is created through the same real service
 * functions (with an explicit, deliberately-earlier
 * `effectiveFrom`/`transactionDate`) the running app itself uses for
 * backdated corrections.
 *
 * Computed relative to the actual moment the seed script runs (rather
 * than a fixed calendar date) so this stays correct no matter when
 * `npm run db:seed` is executed.
 */
const seedRunTime = new Date();
const utcYear = seedRunTime.getUTCFullYear();
const utcMonth = seedRunTime.getUTCMonth();
// Business "founded" 3 calendar months ago - comfortably before any
// previous-period comparison window Phase 4 could compute for today/
// week/month presets.
const BUSINESS_CREATED_AT = new Date(Date.UTC(utcYear, utcMonth - 3, 1, 0, 0, 0)).toISOString();
const BACKFILL_EFFECTIVE_FROM = new Date(Date.UTC(utcYear, utcMonth - 3, 5, 0, 0, 0)).toISOString();
// Middle of last calendar month - always falls inside the "previous
// equivalent period" that Phase 4's month-preset comparison computes,
// regardless of which day of the current month the seed is run on.
const PREVIOUS_MONTH_SALE_DATE = new Date(Date.UTC(utcYear, utcMonth - 1, 15, 10, 0, 0)).toISOString();

async function main() {
  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, DEMO_EMAIL))
    .get();

  if (existing) {
    console.log("Demo user already exists — skipping seed (no duplicates created).");
    sqlite.close();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const userId = randomUUID();

  await db
    .insert(schema.users)
    .values({
      id: userId,
      email: DEMO_EMAIL,
      passwordHash,
      displayName: "Demo Owner",
      createdAt: BUSINESS_CREATED_AT,
      updatedAt: BUSINESS_CREATED_AT,
    })
    .run();

  const businessId = randomUUID();
  await db
    .insert(schema.businesses)
    .values({
      id: businessId,
      userId,
      businessName: "Warung Demo",
      businessType: "street_food",
      currency: "IDR",
      createdAt: BUSINESS_CREATED_AT,
      updatedAt: BUSINESS_CREATED_AT,
    })
    .run();

  console.log("Seed complete (Phase 1):");
  console.log(`  Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Demo business: Warung Demo (${businessId})`);

  // -------------------------------------------------------------------
  // Phase 2 demo catalog data
  // -------------------------------------------------------------------

  const chicken = await createIngredient({
    businessId,
    name: "Chicken Breast",
    baseUnit: "gram",
    initialCost: 50, // Rp50/gram — matches the Master Prompt's worked example
  });

  const bun = await createIngredient({
    businessId,
    name: "Burger Bun",
    baseUnit: "piece",
    initialCost: 2500,
  });

  const sauce = await createIngredient({
    businessId,
    name: "Burger Sauce",
    baseUnit: "milliliter",
    initialCost: 40,
  });

  // Backfill an earlier applicable cost row for each ingredient, dated
  // at business launch, at the SAME cost createIngredient just set. This
  // does not change "current" cost (changeIngredientCost always
  // recomputes it from whichever row is actually most recent) - it only
  // gives the previous-month demo sale below a valid historical cost to
  // resolve, exactly like a real business's actual launch-day pricing
  // would.
  await changeIngredientCost({
    businessId,
    ingredientId: chicken.id,
    costPerBaseUnit: 50,
    effectiveFrom: BACKFILL_EFFECTIVE_FROM,
    notes: "Backdated to business launch",
  });
  await changeIngredientCost({
    businessId,
    ingredientId: bun.id,
    costPerBaseUnit: 2500,
    effectiveFrom: BACKFILL_EFFECTIVE_FROM,
    notes: "Backdated to business launch",
  });
  await changeIngredientCost({
    businessId,
    ingredientId: sauce.id,
    costPerBaseUnit: 40,
    effectiveFrom: BACKFILL_EFFECTIVE_FROM,
    notes: "Backdated to business launch",
  });

  const burger = await createProduct({
    businessId,
    name: "Chicken Burger",
    description: "Grilled chicken burger with house sauce",
    category: "Main",
  });

  await addRecipeItem({ businessId, productId: burger.id, ingredientId: chicken.id, quantity: 150 });
  await addRecipeItem({ businessId, productId: burger.id, ingredientId: bun.id, quantity: 1 });
  await addRecipeItem({ businessId, productId: burger.id, ingredientId: sauce.id, quantity: 20 });

  // First HPP version, at the original chicken price (Rp50/gram):
  // 150*50 + 1*2500 + 20*40 = 7500 + 2500 + 800 = Rp10,800
  await recalculateProductCostVersion(businessId, burger.id);

  await changeSellingPrice({
    businessId,
    productId: burger.id,
    sellingPrice: 18000,
    effectiveFrom: BACKFILL_EFFECTIVE_FROM,
    notes: "Initial launch price",
  });

  // PREVIOUS-MONTH SALE: demonstrates a genuine, non-fabricated
  // period-over-period comparison (Phase 4/5) - this sale is recorded
  // through the same createSale service, dated in the middle of last
  // calendar month, at the launch price/HPP established above. The
  // Intelligence Engine then has a real previous-period baseline (not
  // "insufficient data") to compare this month's revenue against,
  // producing a genuine sales-growth finding downstream in Phase 4/5.
  const previousMonthSale = await createSale({
    businessId,
    transactionDate: PREVIOUS_MONTH_SALE_DATE,
    items: [{ productId: burger.id, quantity: 5 }],
    paymentMethod: "cash",
    notes: "Previous month sale (demonstrates real period-over-period comparison)",
  });

  // Capture this instant BEFORE the ingredient cost rises — a sale
  // recorded "as of" this timestamp will correctly snapshot the OLD
  // price (Rp18,000) and OLD HPP (Rp10,800), demonstrating the Phase 3
  // historical sale integrity rule with real, reproducible data rather
  // than just a comment.
  //
  // BUG FIX (Phase 6 regression testing): this used to be a bare
  // `new Date().toISOString()`, relying only on statement ORDER to stay
  // before the cost/price changes below. On a fast machine, two
  // `new Date().toISOString()` calls a few statements apart can land in
  // the SAME millisecond (ISO timestamps have only millisecond
  // resolution) - and `getApplicableIngredientCost`'s `effectiveFrom <=
  // targetDateIso` filter treats an exact tie as applicable, so a tied
  // "historical" sale could incorrectly pick up the NEW cost/price
  // instead of the old one. An explicit one-minute buffer makes the
  // ordering unambiguous regardless of execution speed, while still
  // safely landing "today" for date-range purposes.
  const historicalSaleDate = new Date(Date.now() - 60_000).toISOString();

  // Demonstrate historical integrity exactly per the Master Prompt's
  // worked example: chicken cost rises from Rp50 to Rp60/gram. The
  // Rp10,800 HPP version above must remain untouched; a new, higher
  // version must appear alongside it.
  await changeIngredientCost({
    businessId,
    ingredientId: chicken.id,
    costPerBaseUnit: 60,
    notes: "Supplier price increase",
  });
  // 150*60 + 1*2500 + 20*40 = 9000 + 2500 + 800 = Rp12,300
  await recalculateProductCostVersion(businessId, burger.id);

  // Selling price also rises afterward, to Rp20,000 — the historical
  // sale below (dated before this change) must still show Rp18,000.
  await changeSellingPrice({
    businessId,
    productId: burger.id,
    sellingPrice: 20000,
    notes: "Price adjusted after ingredient cost increase",
  });

  // A second, sellable product — Iced Lemon Tea — used to demonstrate a
  // genuine multi-product sale below.
  const lemonTea = await createProduct({
    businessId,
    name: "Iced Lemon Tea",
    description: "House-made iced lemon tea",
    category: "Beverage",
  });
  const sugarSyrup = await createIngredient({
    businessId,
    name: "Sugar Syrup",
    baseUnit: "milliliter",
    initialCost: 15,
  });
  await addRecipeItem({
    businessId,
    productId: lemonTea.id,
    ingredientId: sugarSyrup.id,
    quantity: 30,
  });
  await recalculateProductCostVersion(businessId, lemonTea.id);
  await changeSellingPrice({ businessId, productId: lemonTea.id, sellingPrice: 8000 });

  console.log("Seed complete (Phase 2):");
  console.log("  Ingredients: Chicken Breast, Burger Bun, Burger Sauce, Sugar Syrup");
  console.log(
    "  Products: Chicken Burger (2 HPP versions, Rp10,800 -> Rp12,300), Iced Lemon Tea"
  );

  // -------------------------------------------------------------------
  // Phase 3 demo transaction data
  // -------------------------------------------------------------------

  // HISTORICAL SALE: 2x Chicken Burger, recorded as of `historicalSaleDate`
  // — before the chicken cost/price increases above. This is the exact
  // scenario the Phase 3 historical integrity test requires: even though
  // the product's CURRENT price is now Rp20,000 and CURRENT HPP is
  // Rp12,300, this sale's snapshot must permanently show Rp18,000 and
  // Rp10,800.
  const historicalSale = await createSale({
    businessId,
    transactionDate: historicalSaleDate,
    items: [{ productId: burger.id, quantity: 2 }],
    paymentMethod: "cash",
    notes: "Historical sale demonstrating snapshot integrity",
  });

  // CURRENT SALE: a genuine multi-product sale, recorded "now" (after all
  // the price/cost changes), correctly using today's applicable price
  // and HPP for each product.
  const currentSale = await createSale({
    businessId,
    items: [
      { productId: burger.id, quantity: 3 },
      { productId: lemonTea.id, quantity: 2 },
    ],
    paymentMethod: "QRIS",
    notes: "Regular daily sale",
  });

  // EXPENSES — operating costs, never mixed with revenue.
  await createExpense({
    businessId,
    amount: 500000,
    category: "rent",
    description: "Monthly stall rent",
  });
  await createExpense({
    businessId,
    amount: 75000,
    category: "packaging",
    description: "Takeaway boxes and bags",
  });
  await createExpense({
    businessId,
    amount: 50000,
    category: "transportation",
    description: "Market run for ingredients",
  });

  // CAPITAL — money injected by the owner. Never counted as revenue.
  await createCapitalTransaction({
    businessId,
    amount: 2000000,
    source: "owner capital",
    notes: "Initial funding to start the stall",
  });

  // OWNER DRAWING — money taken out by the owner. Never counted as an
  // operating expense.
  await createOwnerDrawing({
    businessId,
    amount: 300000,
    notes: "Personal withdrawal",
  });

  console.log("Seed complete (Phase 3):");
  console.log(
    `  Previous month sale: ${previousMonthSale.transactionNumber} — 5x Chicken Burger @ Rp18,000 (launch price) = Rp${previousMonthSale.totalAmount} revenue`
  );
  console.log(
    `  Historical sale: ${historicalSale.transactionNumber} — 2x Chicken Burger @ Rp18,000/Rp10,800 HPP (snapshot) = Rp${historicalSale.totalAmount} revenue`
  );
  console.log(
    `  Current sale: ${currentSale.transactionNumber} — 3x Chicken Burger + 2x Iced Lemon Tea = Rp${currentSale.totalAmount} revenue`
  );
  console.log("  Expenses: rent (Rp500,000), packaging (Rp75,000), transportation (Rp50,000)");
  console.log("  Capital: Rp2,000,000 owner capital");
  console.log("  Owner drawing: Rp300,000");

  sqlite.close();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
