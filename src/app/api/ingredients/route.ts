import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import {
  createIngredient,
  listIngredients,
  ValidationError,
} from "@/modules/catalog/ingredients";

const createSchema = z.object({
  name: z.string().min(1),
  baseUnit: z.string().min(1),
  initialCost: z.number().min(0),
});

export async function GET() {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const ingredients = await listIngredients(ctx.business.id, {
    includeInactive: true,
  });
  return NextResponse.json({ ingredients });
}

export async function POST(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const json = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ingredient data." }, { status: 400 });
  }

  try {
    const ingredient = await createIngredient({
      businessId: ctx.business.id,
      name: parsed.data.name,
      baseUnit: parsed.data.baseUnit,
      initialCost: parsed.data.initialCost,
    });
    return NextResponse.json({ ingredient });
  } catch (err) {
    if (err instanceof ValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Create ingredient failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
