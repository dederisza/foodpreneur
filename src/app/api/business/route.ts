import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession, setActiveBusinessOnSession } from "@/modules/auth/session";
import { createBusiness, listBusinessesForUser } from "@/modules/business/service";

const bodySchema = z.object({
  businessName: z.string().min(1),
  businessType: z.string().optional(),
  currency: z.string().optional(),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const businesses = await listBusinessesForUser(session.userId);
  return NextResponse.json({ businesses });
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid business data." }, { status: 400 });
  }

  const business = await createBusiness({
    userId: session.userId,
    businessName: parsed.data.businessName,
    businessType: parsed.data.businessType,
    currency: parsed.data.currency,
  });

  // A newly created business automatically becomes the active context —
  // this only ever assigns a business we just verified belongs to this
  // user (we created it with their userId above).
  await setActiveBusinessOnSession(session.id, business.id);

  return NextResponse.json({ business });
}
