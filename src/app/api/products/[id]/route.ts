import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  getOwnedProductOrThrow,
  updateProduct,
} from "@/modules/catalog/products";
import { listRecipeForProduct } from "@/modules/catalog/recipes";
import { calculateCurrentHpp } from "@/modules/costing/hpp";
import { listCostVersionHistory } from "@/modules/costing/service";
import { listSellingPriceHistory } from "@/modules/pricing/service";
import { ValidationError } from "@/modules/catalog/ingredients";
import { OwnershipError } from "@/modules/business/service";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    const product = await getOwnedProductOrThrow(ctx.business.id, id);
    const [recipe, hpp, costVersions, priceHistory] = await Promise.all([
      listRecipeForProduct(ctx.business.id, id),
      calculateCurrentHpp(ctx.business.id, id),
      listCostVersionHistory(ctx.business.id, id),
      listSellingPriceHistory(ctx.business.id, id),
    ]);

    return NextResponse.json({ product, recipe, hpp, costVersions, priceHistory });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Get product failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
  }

  try {
    const product = await updateProduct(ctx.business.id, id, parsed.data);
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update product failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
