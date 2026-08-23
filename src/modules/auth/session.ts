import { SignJWT, jwtVerify } from "jose";
import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { Session } from "@/db/schema";

const SESSION_COOKIE_NAME = "app_session";
const SESSION_TTL_DAYS = 30;

function getSecretKey() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short. Set a random string of at least 32 characters in your environment (see .env.example)."
    );
  }
  return new TextEncoder().encode(secret);
}

/**
 * Creates a new server-side session row and returns a signed JWT that
 * only carries the session id. All meaningful state (user id, active
 * business) lives in the database row, not in the token, so sessions can
 * be revoked (logout) by deleting the row.
 */
export async function createSession(userId: string): Promise<string> {
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db
    .insert(schema.sessions)
    .values({
      id,
      userId,
      activeBusinessId: null,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    .run();

  const token = await new SignJWT({ sid: id })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_DAYS}d`)
    .sign(getSecretKey());

  return token;
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

/**
 * Resolves the current request's session row, verifying the signed
 * cookie and checking DB-side expiry. Returns null if there is no valid
 * session — callers must treat that as "unauthenticated" and must not
 * fall back to any cached or client-supplied identity.
 */
export async function getCurrentSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  let sessionId: string;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (typeof payload.sid !== "string") return null;
    sessionId = payload.sid;
  } catch {
    return null;
  }

  const session = await db
    .select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, sessionId))
    .get();

  if (!session) return null;
  if (new Date(session.expiresAt).getTime() < Date.now()) {
    // Expired: clean up and treat as unauthenticated.
    await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
    return null;
  }

  return session;
}

export async function destroySession(sessionId: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, sessionId)).run();
}

/**
 * Persists the active business selection on the session row. The caller
 * MUST have already verified that businessId belongs to the session's
 * user — this function does not re-check ownership.
 */
export async function setActiveBusinessOnSession(
  sessionId: string,
  businessId: string
) {
  await db
    .update(schema.sessions)
    .set({ activeBusinessId: businessId })
    .where(eq(schema.sessions.id, sessionId))
    .run();
}
