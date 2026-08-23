import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  createCapitalTransaction,
  listCapitalTransactions,
  ValidationError,
} from "@/modules/finance/capital";

const createSchema = z.object({
  amount: z.number().positive(),
  transactionDate: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const capitalTransactions = await listCapitalTransactions(
    ctx.business.id,
    from && to ? { from, to } : undefined
  );
  return NextResponse.json({ capitalTransactions });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid capital data." }, { status: 400 });
  }

  try {
    const capitalTransaction = await createCapitalTransaction({
      businessId: ctx.business.id,
      amount: parsed.data.amount,
      transactionDate: parsed.data.transactionDate,
      source: parsed.data.source,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ capitalTransaction });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create capital transaction failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
