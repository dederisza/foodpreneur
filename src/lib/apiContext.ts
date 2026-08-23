import { NextResponse } from "next/server";
import { getCurrentSession, setActiveBusinessOnSession } from "@/modules/auth/session";
import {
  getOwnedBusinessOrThrow,
  listBusinessesForUser,
  OwnershipError,
} from "@/modules/business/service";
import type { Business, Session } from "@/db/schema";

/**
 * Shared entry point for Phase 2+ API routes that operate on
 * business-scoped resources (ingredients, products, recipes, etc).
 *
 * Resolves the current session and its active business, re-validating
 * ownership of the active business against the authenticated user every
 * time (never trusts session.activeBusinessId blindly) — same principle
 * as requireBusinessContext() in src/lib/context.ts, just shaped for JSON
 * API routes instead of page redirects.
 *
 * FIX (Phase 2 verification): if the session has no active business yet
 * (e.g. immediately after a fresh login, before the user has loaded any
 * /app/* page), this now falls back to the user's first owned business —
 * mirroring src/app/app/layout.tsx's fallback exactly — instead of
 * incorrectly blocking the request with "No active business selected."
 * Previously, a freshly logged-in user calling the API directly (rather
 * than navigating the UI first) would get blocked even though they
 * unambiguously owned exactly one business. The fallback only ever
 * selects a business already scoped to this user via
 * listBusinessesForUser, so it carries no ownership risk.
 *
 * Returns either the resolved { session, business } or a ready-to-return
 * NextResponse error, so callers can do:
 *
 *   const ctx = await requireActiveBusinessForApi();
 *   if (ctx instanceof NextResponse) return ctx;
 */
export async function requireActiveBusinessForApi(): Promise<
  { session: Session; business: Business } | NextResponse
> {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  if (session.activeBusinessId) {
    try {
      const business = await getOwnedBusinessOrThrow(
        session.userId,
        session.activeBusinessId
      );
      return { session, business };
    } catch (err) {
      if (!(err instanceof OwnershipError)) throw err;
      // Stale/tampered active_business_id: fall through to the
      // first-owned-business fallback below rather than failing outright.
    }
  }

  const businesses = await listBusinessesForUser(session.userId);
  if (businesses.length === 0) {
    return NextResponse.json(
      { error: "No business exists for this account yet." },
      { status: 400 }
    );
  }

  const fallbackBusiness = businesses[0];
  await setActiveBusinessOnSession(session.id, fallbackBusiness.id);
  return { session, business: fallbackBusiness };
}
