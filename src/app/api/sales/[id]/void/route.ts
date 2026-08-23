import { NextRequest, NextResponse } from "next/server";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { voidSale } from "@/modules/sales/service";
import { OwnershipError } from "@/modules/business/service";

/**
 * Voids a sale rather than editing or deleting it (Phase 3 Section 23,
 * Option C) — see the comment on voidSale in modules/sales/service.ts.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    const sale = await voidSale(ctx.business.id, id);
    return NextResponse.json({ sale });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Void sale failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
