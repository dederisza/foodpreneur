import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  createOwnerDrawing,
  listOwnerDrawings,
  ValidationError,
} from "@/modules/finance/drawings";

const createSchema = z.object({
  amount: z.number().positive(),
  transactionDate: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const ownerDrawings = await listOwnerDrawings(
    ctx.business.id,
    from && to ? { from, to } : undefined
  );
  return NextResponse.json({ ownerDrawings });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid owner drawing data." }, { status: 400 });
  }

  try {
    const ownerDrawing = await createOwnerDrawing({
      businessId: ctx.business.id,
      amount: parsed.data.amount,
      transactionDate: parsed.data.transactionDate,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ ownerDrawing });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create owner drawing failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
