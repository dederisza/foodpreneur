import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyCredentials, AuthError } from "@/modules/auth/service";
import { createSession, setSessionCookie } from "@/modules/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid login data." },
      { status: 400 }
    );
  }

  try {
    const user = await verifyCredentials(parsed.data.email, parsed.data.password);
    const token = await createSession(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 401 });
    }
    console.error("Login failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
