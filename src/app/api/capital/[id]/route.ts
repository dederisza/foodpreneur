import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  getOwnedCapitalTransactionOrThrow,
  updateCapitalTransaction,
  deleteCapitalTransaction,
  ValidationError,
} from "@/modules/finance/capital";
import { OwnershipError } from "@/modules/business/service";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  transactionDate: z.string().optional(),
  source: z.string().nullable().optional(),
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
    const capitalTransaction = await getOwnedCapitalTransactionOrThrow(ctx.business.id, id);
    return NextResponse.json({ capitalTransaction });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Get capital transaction failed:", err);
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
    return NextResponse.json({ error: "Invalid capital data." }, { status: 400 });
  }

  try {
    const capitalTransaction = await updateCapitalTransaction(ctx.business.id, id, parsed.data);
    return NextResponse.json({ capitalTransaction });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update capital transaction failed:", err);
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
    await deleteCapitalTransaction(ctx.business.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Delete capital transaction failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
