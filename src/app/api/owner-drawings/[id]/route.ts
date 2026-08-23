import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  getOwnedDrawingOrThrow,
  updateOwnerDrawing,
  deleteOwnerDrawing,
  ValidationError,
} from "@/modules/finance/drawings";
import { OwnershipError } from "@/modules/business/service";

const updateSchema = z.object({
  amount: z.number().positive().optional(),
  transactionDate: z.string().optional(),
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
    const ownerDrawing = await getOwnedDrawingOrThrow(ctx.business.id, id);
    return NextResponse.json({ ownerDrawing });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Get owner drawing failed:", err);
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
    return NextResponse.json({ error: "Invalid owner drawing data." }, { status: 400 });
  }

  try {
    const ownerDrawing = await updateOwnerDrawing(ctx.business.id, id, parsed.data);
    return NextResponse.json({ ownerDrawing });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Update owner drawing failed:", err);
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
    await deleteOwnerDrawing(ctx.business.id, id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Delete owner drawing failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
