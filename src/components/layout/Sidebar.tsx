"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * PRIMARY NAVIGATION (Phase 6 fix)
 * ---------------------------------------------------------------------------
 * Grouped to match the app's real, demonstrable journey: Overview ->
 * Business Setup -> Daily Activity -> Business Analysis -> Account.
 *
 * Diagnostics, Health, Actions, and Goals are deliberately NOT listed
 * here - their route files still exist (src/app/app/{diagnostics,health,
 * actions,goals}/page.tsx) and remain reachable by direct URL, but they
 * only render a ComingSoon placeholder and have no real functionality
 * yet, so they no longer appear as dead-end links in the primary nav.
 * Every item below leads to a fully implemented, functional page.
 */
const NAV_GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/app/dashboard", label: "Dashboard" }],
  },
  {
    label: "Business Setup",
    items: [
      { href: "/app/ingredients", label: "Ingredients" },
      { href: "/app/products", label: "Products" },
    ],
  },
  {
    label: "Daily Activity",
    items: [
      { href: "/app/sales", label: "Sales" },
      { href: "/app/expenses", label: "Expenses" },
      { href: "/app/capital", label: "Capital" },
      { href: "/app/owner-drawings", label: "Owner Drawings" },
      { href: "/app/transactions", label: "Transaction History" },
    ],
  },
  {
    label: "Business Analysis",
    items: [
      { href: "/app/activity", label: "Financial Summary" },
      { href: "/app/analysis", label: "Business Intelligence" },
      { href: "/app/strategy", label: "AI Synthesis & START" },
      { href: "/app/reports", label: "Reports" },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/app/settings", label: "Settings" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-56 shrink-0 flex-col gap-4 overflow-y-auto border-r border-slate-200 bg-white px-3 py-4">
      <div className="px-3 text-lg font-semibold text-emerald-700">
        Foodpreneur BI
      </div>
      {NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
            {group.label}
          </p>
          <div className="flex flex-col gap-1">
            {group.items.map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
