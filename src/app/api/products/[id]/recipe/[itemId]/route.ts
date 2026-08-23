import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  updateRecipeItemQuantity,
  removeRecipeItem,
} from "@/modules/catalog/recipes";
import { recalculateProductCostVersion } from "@/modules/costing/service";
import { ValidationError } from "@/modules/catalog/ingredients";
import { OwnershipError } from "@/modules/business/service";

const bodySchema = z.object({
  quantity: z.number().positive(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id, itemId } = await params;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid recipe data." }, { status: 400 });
  }

  try {
    const recipeItem = await updateRecipeItemQuantity({
      businessId: ctx.business.id,
      productId: id,
      recipeItemId: itemId,
      quantity: parsed.data.quantity,
    });
    await recalculateProductCostVersion(ctx.business.id, id);
    return NextResponse.json({ recipeItem });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update recipe item failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id, itemId } = await params;

  try {
    await removeRecipeItem({
      businessId: ctx.business.id,
      productId: id,
      recipeItemId: itemId,
    });
    await recalculateProductCostVersion(ctx.business.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Remove recipe item failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
