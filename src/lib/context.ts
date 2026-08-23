import { redirect } from "next/navigation";
import { getCurrentSession } from "@/modules/auth/session";
import { getUserById } from "@/modules/auth/service";
import {
  getOwnedBusinessOrThrow,
  listBusinessesForUser,
} from "@/modules/business/service";
import type { User, Business, Session } from "@/db/schema";

export type AppContext = {
  user: User;
  session: Session;
  businesses: Business[];
  activeBusiness: Business | null;
};

/**
 * Single entry point every protected server component / route handler
 * should use to resolve "who is logged in and which business are they
 * looking at". Centralizing this avoids each module re-implementing its
 * own (possibly inconsistent) authentication + ownership checks.
 *
 * Redirects to /login if there is no valid session — callers in Server
 * Components can rely on the return value always being authenticated.
 */
export async function requireAppContext(): Promise<AppContext> {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const user = await getUserById(session.userId);
  if (!user) {
    // Session pointed at a user that no longer exists — treat as logged out.
    redirect("/login");
  }

  const businesses = await listBusinessesForUser(user.id);

  let activeBusiness: Business | null = null;
  if (session.activeBusinessId) {
    try {
      activeBusiness = await getOwnedBusinessOrThrow(
        user.id,
        session.activeBusinessId
      );
    } catch {
      // Stale or tampered active business id: fall back to "none selected"
      // rather than silently trusting it.
      activeBusiness = null;
    }
  }

  return { user, session, businesses, activeBusiness };
}

/**
 * Like requireAppContext, but also enforces that an active business is
 * selected — for the majority of application pages that cannot function
 * without one. Redirects to onboarding if no business exists yet, or to
 * the business-selection state if businesses exist but none is active.
 */
export async function requireBusinessContext(): Promise<
  AppContext & { activeBusiness: Business }
> {
  const ctx = await requireAppContext();

  if (ctx.businesses.length === 0) {
    redirect("/onboarding");
  }

  if (!ctx.activeBusiness) {
    redirect("/app/settings?select_business=1");
  }

  return ctx as AppContext & { activeBusiness: Business };
}
