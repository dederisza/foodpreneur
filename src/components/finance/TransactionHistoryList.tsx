"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { TransactionEntry } from "@/modules/finance/transactionHistory";
import { formatCurrency, formatDateTime as formatDate } from "@/lib/format";

const TYPE_LABELS: Record<TransactionEntry["type"], string> = {
  sale: "Sale",
  expense: "Expense",
  capital: "Capital",
  owner_drawing: "Owner Drawing",
};

const TYPE_BADGE_CLASSES: Record<TransactionEntry["type"], string> = {
  sale: "bg-emerald-50 text-emerald-700",
  expense: "bg-red-50 text-red-700",
  capital: "bg-blue-50 text-blue-700",
  owner_drawing: "bg-amber-50 text-amber-700",
};

// Sales and Capital are money IN; Expenses and Owner Drawings are money
// OUT. This is purely a display sign for readability in the combined
// list — it does not change any of the underlying financial formulas,
// which remain in modules/finance/summary.ts exactly as before.
const TYPE_SIGN: Record<TransactionEntry["type"], "+" | "-"> = {
  sale: "+",
  expense: "-",
  capital: "+",
  owner_drawing: "-",
};

export function TransactionHistoryList({
  transactions,
  currency,
}: {
  transactions: TransactionEntry[];
  currency: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Transaction History</h1>
        <p className="mt-1 text-sm text-slate-500">
          Every sale, expense, capital injection, and owner drawing for
          this business, in one chronological list.
        </p>
      </div>

      {transactions.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No transactions recorded yet.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((t) => {
                const row = (
                  <tr key={`${t.type}-${t.id}`} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE_CLASSES[t.type]}`}
                      >
                        {TYPE_LABELS[t.type]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-900">
                      {t.type === "sale" ? (
                        <Link href={`/app/sales/${t.id}`} className="hover:underline">
                          {t.description}
                        </Link>
                      ) : (
                        t.description
                      )}
                      {t.category && t.type !== "sale" && (
                        <span className="ml-2 text-xs capitalize text-slate-400">
                          {t.category}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-900">
                      {TYPE_SIGN[t.type]} {formatCurrency(t.amount, currency)}
                    </td>
                  </tr>
                );
                return row;
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
