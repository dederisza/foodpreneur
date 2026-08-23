import { redirect } from "next/navigation";
import { requireAppContext } from "@/lib/context";
import { CreateBusinessForm } from "@/components/business/CreateBusinessForm";
import { Card } from "@/components/ui/Card";

export default async function OnboardingPage() {
  const ctx = await requireAppContext();

  // Already has at least one business — onboarding is done, go straight
  // into the app (requireBusinessContext there will resolve the active one).
  if (ctx.businesses.length > 0) {
    redirect("/app/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <Card className="w-full max-w-md">
        <h1 className="text-xl font-semibold text-slate-900">
          Let&apos;s set up your first business
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Just the basics for now — you can refine everything later.
        </p>

        <div className="mt-6">
          <CreateBusinessForm />
        </div>
      </Card>
    </main>
  );
}
