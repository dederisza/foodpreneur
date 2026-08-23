import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerUser, AuthError } from "@/modules/auth/service";
import { createSession, setSessionCookie } from "@/modules/auth/session";

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid registration data." },
      { status: 400 }
    );
  }

  try {
    const user = await registerUser(parsed.data);
    const token = await createSession(user.id);
    await setSessionCookie(token);

    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("Registration failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
