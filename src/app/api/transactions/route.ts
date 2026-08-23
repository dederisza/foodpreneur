import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveBusinessForApi } from "@/lib/apiContext";
import { listTransactionHistory } from "@/modules/finance/transactionHistory";
import { resolveRange, type RangePreset } from "@/modules/finance/dateRanges";

const querySchema = z.object({
  preset: z.enum(["today", "week", "month", "custom", "all"]).default("all"),
  from: z.string().optional(),
  to: z.string().optional(),
});

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
    const range =
      parsed.data.preset === "all"
        ? undefined
        : resolveRange(parsed.data.preset as RangePreset, {
            from: parsed.data.from ?? "",
            to: parsed.data.to ?? "",
          });
    const transactions = await listTransactionHistory(ctx.business.id, range);
    return NextResponse.json({ transactions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid date range.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
