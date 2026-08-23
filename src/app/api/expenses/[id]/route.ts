import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  getOwnedExpenseOrThrow,
  updateExpense,
  deleteExpense,
  ValidationError,
} from "@/modules/finance/expenses";
import { OwnershipError } from "@/modules/business/service";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  category: z.string().min(1).optional(),
  transactionDate: z.string().optional(),
  description: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    const expense = await getOwnedExpenseOrThrow(ctx.business.id, id);
    return NextResponse.json({ expense });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Get expense failed:", err);
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
    return NextResponse.json({ error: "Invalid expense data." }, { status: 400 });
  }

  try {
    const expense = await updateExpense(ctx.business.id, id, parsed.data);
    return NextResponse.json({ expense });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update expense failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    await deleteExpense(ctx.business.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Delete expense failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
