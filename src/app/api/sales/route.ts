import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { createSale, listSales, ValidationError } from "@/modules/sales/service";
import { OwnershipError } from "@/modules/business/service";

const itemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().positive(),
});

const createSchema = z.object({
  items: z.array(itemSchema).min(1),
  transactionDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const sales = await listSales(
    ctx.business.id,
    from && to ? { from, to } : undefined
  );
  return NextResponse.json({ sales });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sale data." }, { status: 400 });
  }

  try {
    const sale = await createSale({
      businessId: ctx.business.id,
      items: parsed.data.items,
      transactionDate: parsed.data.transactionDate,
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ sale });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create sale failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
