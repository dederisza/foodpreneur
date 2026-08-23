import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { createExpense, listExpenses, ValidationError } from "@/modules/finance/expenses";

const createSchema = z.object({
  amount: z.number().positive(),
  category: z.string().min(1),
  transactionDate: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const expenses = await listExpenses(
    ctx.business.id,
    from && to ? { from, to } : undefined
  );
  return NextResponse.json({ expenses });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid expense data." }, { status: 400 });
  }

  try {
    const expense = await createExpense({
      businessId: ctx.business.id,
      amount: parsed.data.amount,
      category: parsed.data.category,
      transactionDate: parsed.data.transactionDate,
      description: parsed.data.description,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ expense });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create expense failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
