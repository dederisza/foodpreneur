import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession, setActiveBusinessOnSession } from "@/modules/auth/session";
import { getOwnedBusinessOrThrow, OwnershipError } from "@/modules/business/service";

const bodySchema = z.object({
  businessId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    // NEVER trust the client-supplied businessId without this check.
    const business = await getOwnedBusinessOrThrow(session.userId, parsed.data.businessId);
    await setActiveBusinessOnSession(session.id, business.id);
    return NextResponse.json({ business });
  } catch (err) {
    if (err instanceof OwnershipError) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    console.error("Business selection failed:", err);
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
