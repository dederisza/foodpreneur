import { NextResponse } from "next/server";
import {
  getCurrentSession,
  destroySession,
  clearSessionCookie,
} from "@/modules/auth/session";

export async function POST() {
  const session = await getCurrentSession();
  if (session) {
    await destroySession(session.id);
  }
  await clearSessionCookie();
  return NextResponse.json({ success: true });
}
