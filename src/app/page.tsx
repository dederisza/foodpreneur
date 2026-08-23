import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-emerald-50 to-white">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold text-emerald-700">Foodpreneur BI</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Log in
          </Link>
          <Link href="/register">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-5xl">
          Understand your food business, one clear insight at a time.
        </h1>
        <p className="mt-5 max-w-xl text-base text-slate-600 sm:text-lg">
          Record your daily sales and expenses, and let the system turn it into
          real metrics, honest diagnostics, and a short list of what actually
          matters next.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link href="/register">
            <Button className="px-6 py-3 text-base">Start growing your business</Button>
          </Link>
          <Link href="/start">
            <Button variant="secondary" className="px-6 py-3 text-base">
              Planning a new business?
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-6 text-center text-xs text-slate-400">
        Foodpreneur BI — foundation build (Phase 1)
      </footer>
    </main>
  );
}
