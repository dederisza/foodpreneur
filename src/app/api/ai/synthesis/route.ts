import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { generateAiSynthesis } from "@/modules/ai/synthesis";
import { resolveRange, type RangePreset } from "@/modules/finance/dateRanges";

const querySchema = z.object({
  preset: z.enum(["today", "week", "month", "custom"]).default("month"),
  from: z.string().optional(),
  to: z.string().optional(),
});

/**
 * PHASE 5 SECURITY (Section 8)
 * ---------------------------------------------------------------------------
 * Deliberately identical pattern to /api/intelligence: the active
 * business is resolved server-side via requireActiveBusinessForApi,
 * which re-validates ownership against the authenticated session every
 * request - a client can never supply or influence which business's
 * data gets synthesized, only which date range to view it over.
 */
export async function GET(req: NextRequest) {
  const ctx = await requireActiveBusinessForApi();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(req.url);
  const parsed = querySchema.safeParse({
    preset: searchParams.get("preset") ?? undefined,
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  try {
    const range = resolveRange(parsed.data.preset as RangePreset, {
      from: parsed.data.from ?? "",
      to: parsed.data.to ?? "",
    });
    const result = await generateAiSynthesis(ctx.business.id, range);
    return NextResponse.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid date range.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
