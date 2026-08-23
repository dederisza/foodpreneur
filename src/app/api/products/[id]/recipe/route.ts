import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { addRecipeItem } from "@/modules/catalog/recipes";
import { recalculateProductCostVersion } from "@/modules/costing/service";
import { ValidationError } from "@/modules/catalog/ingredients";
import { OwnershipError } from "@/modules/business/service";

const bodySchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
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
    return NextResponse.json({ error: "Invalid recipe data." }, { status: 400 });
  }

  try {
    const recipeItem = await addRecipeItem({
      businessId: ctx.business.id,
      productId: id,
      ingredientId: parsed.data.ingredientId,
      quantity: parsed.data.quantity,
    });

    // Recipe composition changes are one of the HPP recalculation
    // triggers (Phase 2, Section 20) — recalculated immediately here.
    await recalculateProductCostVersion(ctx.business.id, id);

    return NextResponse.json({ recipeItem });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Add recipe item failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
