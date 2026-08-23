import { listRecipeForProduct } from "@/modules/catalog/recipes";
import { getApplicableIngredientCost } from "@/modules/catalog/ingredients";

/**
 * DETERMINISTIC HPP ENGINE (Phase 2, Section 11-12)
 * ---------------------------------------------------------------------------
 * This is plain arithmetic over data already produced by the deterministic
 * catalog/costing layer. No AI is involved anywhere in this file, by
 * design — HPP is a fact the system computes, not something an AI model
 * interprets or estimates. This keeps the calculation independently
 * testable: given a recipe and a set of ingredient costs, the total is
 * always the same number, every time.
 *
 * Total Product HPP = SUM(recipe_quantity × applicable_cost_per_base_unit)
 * ------------------------------------------------------------------------ */

/**
 * PRECISION STRATEGY (Phase 2 verification, Section 25):
 * ---------------------------------------------------------------------------
 * All monetary values in this app are plain JS numbers stored in SQLite
 * `REAL` columns — there is no fixed-point/decimal type in this stack.
 * Floating-point arithmetic on doubles can produce artifacts like
 * `9700.000000000002` from a chain of multiplications and additions. Left
 * unrounded, this would not only look wrong to a user but could also
 * defeat the HPP-version dedupe check in costing/service.ts (which
 * compares totals with a small tolerance specifically to guard against
 * this).
 *
 * Chosen fix: round every contribution and the total to 2 decimal places
 * (cent-level precision) at the point of calculation, via `roundMoney`
 * below. This is a rounding *display/storage* concern, not a business
 * rule — it does not change which ingredients contribute or how much,
 * it just removes binary-floating-point noise before the number is
 * shown or persisted. Chosen over introducing a decimal/bignum library
 * because at MVP scale (a single business's own catalog) the values
 * involved are far below the range where float precision loss would
 * itself cause a wrong business decision — the actual risk was purely
 * the trailing-digit noise, which this eliminates.
 * ------------------------------------------------------------------------ */
function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export type HppLineItem = {
  ingredientId: string;
  ingredientName: string;
  quantity: number;
  baseUnit: string;
  costPerBaseUnit: number;
  costEffectiveFrom: string;
  contribution: number;
};

export type HppResult =
  | {
      status: "ok";
      totalCost: number;
      lineItems: HppLineItem[];
      calculatedAt: string;
    }
  | { status: "no_recipe"; calculatedAt: string }
  | {
      status: "missing_cost_data";
      missingIngredientNames: string[];
      calculatedAt: string;
    };

/**
 * Calculates a product's HPP as of `asOfIso` (defaults to now) using the
 * product's current recipe and the applicable ingredient cost for each
 * line at that date. Never invents a number: a recipe with no items, or
 * an ingredient with no cost history at or before `asOfIso`, produces an
 * explicit non-"ok" status instead of a misleading total (Phase 2,
 * Section 21).
 */
export async function calculateCurrentHpp(
  businessId: string,
  productId: string,
  asOfIso?: string
): Promise<HppResult> {
  const calculatedAt = asOfIso ?? new Date().toISOString();
  const recipe = await listRecipeForProduct(businessId, productId);

  if (recipe.length === 0) {
    return { status: "no_recipe", calculatedAt };
  }

  const lineItems: HppLineItem[] = [];
  const missingIngredientNames: string[] = [];

  for (const item of recipe) {
    const applicableCost = await getApplicableIngredientCost(
      businessId,
      item.ingredientId,
      calculatedAt
    );

    if (!applicableCost) {
      missingIngredientNames.push(item.ingredientName);
      continue;
    }

    lineItems.push({
      ingredientId: item.ingredientId,
      ingredientName: item.ingredientName,
      quantity: item.quantity,
      baseUnit: item.ingredientBaseUnit,
      costPerBaseUnit: applicableCost.costPerBaseUnit,
      costEffectiveFrom: applicableCost.effectiveFrom,
      contribution: roundMoney(item.quantity * applicableCost.costPerBaseUnit),
    });
  }

  if (missingIngredientNames.length > 0) {
    return { status: "missing_cost_data", missingIngredientNames, calculatedAt };
  }

  const totalCost = roundMoney(lineItems.reduce((sum, li) => sum + li.contribution, 0));

  return { status: "ok", totalCost, lineItems, calculatedAt };
}
