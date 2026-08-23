import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { changeIngredientCost, ValidationError } from "@/modules/catalog/ingredients";
import { recalculateProductsUsingIngredient } from "@/modules/costing/service";
import { OwnershipError } from "@/modules/business/service";

const bodySchema = z.object({
  costPerBaseUnit: z.number().min(0),
  effectiveFrom: z.string().optional(),
  notes: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid cost data." }, { status: 400 });
  }

  try {
    const costRecord = await changeIngredientCost({
      businessId: ctx.business.id,
      ingredientId: id,
      costPerBaseUnit: parsed.data.costPerBaseUnit,
      effectiveFrom: parsed.data.effectiveFrom,
      notes: parsed.data.notes,
    });

    // Ingredient cost changes ripple into every product that uses this
    // ingredient (Phase 2, Section 14) — recalculated here, at the
    // composition layer, to keep modules/catalog independent of
    // modules/costing (avoids a circular module dependency).
    await recalculateProductsUsingIngredient(ctx.business.id, id);

    return NextResponse.json({ costRecord });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Change ingredient cost failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
