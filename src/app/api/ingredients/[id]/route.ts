import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  getOwnedIngredientOrThrow,
  updateIngredient,
  listIngredientCostHistory,
  ValidationError,
} from "@/modules/catalog/ingredients";
import { OwnershipError } from "@/modules/business/service";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  baseUnit: z.string().min(1).optional(),
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
    const ingredient = await getOwnedIngredientOrThrow(ctx.business.id, id);
    const costHistory = await listIngredientCostHistory(ctx.business.id, id);
    return NextResponse.json({ ingredient, costHistory });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Get ingredient failed:", err);
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
    return NextResponse.json({ error: "Invalid ingredient data." }, { status: 400 });
  }

  try {
    const ingredient = await updateIngredient(ctx.business.id, id, parsed.data);
    return NextResponse.json({ ingredient });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update ingredient failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
