import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { changeSellingPrice } from "@/modules/pricing/service";
import { ValidationError } from "@/modules/catalog/ingredients";
import { OwnershipError } from "@/modules/business/service";

const bodySchema = z.object({
  sellingPrice: z.number().min(0),
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
    return NextResponse.json({ error: "Invalid price data." }, { status: 400 });
  }

  try {
    const priceRecord = await changeSellingPrice({
      businessId: ctx.business.id,
      productId: id,
      sellingPrice: parsed.data.sellingPrice,
      effectiveFrom: parsed.data.effectiveFrom,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ priceRecord });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Change selling price failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
