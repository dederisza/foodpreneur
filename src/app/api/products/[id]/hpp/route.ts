import { NextRequest, NextResponse } from "next/server";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { recalculateProductCostVersion } from "@/modules/costing/service";
import { OwnershipError } from "@/modules/business/service";
import { getOwnedProductOrThrow } from "@/modules/catalog/products";

/**
 * Manual "recalculate HPP" action (Phase 2, Section 20, trigger #4).
 * Mainly useful as a safety net / explicit user action on the product
 * detail page — the automatic triggers (recipe changes, ingredient cost
 * changes) already cover the common cases.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    await getOwnedProductOrThrow(ctx.business.id, id);
    const outcome = await recalculateProductCostVersion(ctx.business.id, id);
    return NextResponse.json({ outcome });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Recalculate HPP failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
