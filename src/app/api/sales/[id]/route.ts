import { NextRequest, NextResponse } from "next/server";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { getOwnedSaleOrThrow } from "@/modules/sales/service";
import { OwnershipError } from "@/modules/business/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;

  try {
    const sale = await getOwnedSaleOrThrow(ctx.business.id, id);
    return NextResponse.json({ sale });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Get sale failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
