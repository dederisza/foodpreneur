import Link from "next/link";
import { requireBusinessContext } from "@/lib/context";
import { Card } from "@/components/ui/Card";

const QUICK_LINKS = [
  {
    href: "/app/ingredients",
    title: "Business Setup",
    description: "Ingredients, products, recipes, HPP, and pricing.",
  },
  {
    href: "/app/sales",
    title: "Daily Activity",
    description: "Record sales, expenses, capital, and owner drawings.",
  },
  {
    href: "/app/analysis",
    title: "Business Intelligence",
    description: "See what your real data says: findings from data, metrics, and rules.",
  },
  {
    href: "/app/strategy",
    title: "AI Synthesis & START",
    description: "A prioritized summary and a concrete START action plan.",
  },
  {
    href: "/app/reports",
    title: "Reports",
    description: "Business summary, sales, intelligence, and START in one view.",
  },
];

export default async function DashboardPage() {
  const ctx = await requireBusinessContext();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome, {ctx.user.displayName ?? ctx.user.email}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s the current status of {ctx.activeBusiness.businessName}.
        </p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Business context</h2>
        <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-slate-400">Business name</dt>
            <dd className="font-medium text-slate-900">
              {ctx.activeBusiness.businessName}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Type</dt>
            <dd className="font-medium text-slate-900">
              {ctx.activeBusiness.businessType ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-slate-400">Currency</dt>
            <dd className="font-medium text-slate-900">
              {ctx.activeBusiness.currency}
            </dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">Where to go next</h2>
        <p className="mt-1 text-sm text-slate-500">
          From raw daily records to a prioritized action plan.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-slate-200 p-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
            >
              <h3 className="text-sm font-semibold text-slate-900">{link.title}</h3>
              <p className="mt-1 text-xs text-slate-500">{link.description}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
