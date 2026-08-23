import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { createProduct, listProducts } from "@/modules/catalog/products";
import { ValidationError } from "@/modules/catalog/ingredients";

const createSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
});

export async function GET() {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const products = await listProducts(ctx.business.id, { includeInactive: true });
  return NextResponse.json({ products });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product data." }, { status: 400 });
  }

  try {
    const product = await createProduct({
      businessId: ctx.business.id,
      name: parsed.data.name,
      description: parsed.data.description,
      category: parsed.data.category,
    });
    return NextResponse.json({ product });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create product failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
