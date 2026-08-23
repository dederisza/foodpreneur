import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/client";
import type { User } from "@/db/schema";

const SALT_ROUNDS = 12;

export class AuthError extends Error {}

/**
 * Registers a new user. Throws AuthError for known, user-facing failure
 * cases (duplicate email, weak password) so route handlers can present a
 * clean message instead of a stack trace.
 */
export async function registerUser(params: {
  email: string;
  password: string;
  displayName?: string;
}): Promise<User> {
  const email = params.email.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    throw new AuthError("A valid email address is required.");
  }
  if (!params.password || params.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.");
  }

  const existing = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .get();

  if (existing) {
    throw new AuthError("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
  const id = randomUUID();
  const now = new Date().toISOString();

  await db
    .insert(schema.users)
    .values({
      id,
      email,
      passwordHash,
      displayName: params.displayName?.trim() || null,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  const created = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();

  if (!created) {
    throw new Error("Failed to create user record.");
  }

  return created;
}

/**
 * Verifies email/password credentials. Returns the user on success or
 * throws AuthError on failure. Intentionally uses the same error message
 * for "no such user" and "wrong password" to avoid leaking which emails
 * are registered.
 */
export async function verifyCredentials(
  email: string,
  password: string
): Promise<User> {
  const normalizedEmail = email.trim().toLowerCase();

  const user = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .get();

  if (!user) {
    throw new AuthError("Invalid email or password.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthError("Invalid email or password.");
  }

  return user;
}

export async function getUserById(userId: string): Promise<User | undefined> {
  return db.select().from(schema.users).where(eq(schema.users.id, userId)).get();
}
