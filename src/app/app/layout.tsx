import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/context";
import { setActiveBusinessOnSession } from "@/modules/auth/session";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requireAppContext();

  // No business yet at all — send through onboarding first.
  if (ctx.businesses.length === 0) {
    redirect("/onboarding");
  }

  // Businesses exist, but none is currently active (e.g. a fresh login,
  // or a stale/tampered active_business_id). Default to the user's first
  // owned business — this is safe because ctx.businesses is already
  // scoped to the authenticated user, so we are never assigning a
  // business we haven't verified they own.
  const activeBusiness = ctx.activeBusiness ?? ctx.businesses[0];
  if (!ctx.activeBusiness) {
    await setActiveBusinessOnSession(ctx.session.id, activeBusiness.id);
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar
          businessName={activeBusiness.businessName}
          userDisplayName={ctx.user.displayName ?? ctx.user.email}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
