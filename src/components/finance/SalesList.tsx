"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { Sale } from "@/db/schema";
import { formatCurrency, formatDateTime as formatDate } from "@/lib/format";

export function SalesList({
  initialSales,
  currency,
}: {
  initialSales: Sale[];
  currency: string;
}) {
  const [sales] = useState(initialSales);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Sales</h1>
        <Link href="/app/sales/new">
          <Button>+ New sale</Button>
        </Link>
      </div>

      {sales.length === 0 ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No sales recorded yet.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Transaction #</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 text-slate-600">{formatDate(s.transactionDate)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {s.transactionNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {formatCurrency(s.totalAmount, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        s.status === "completed"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/app/sales/${s.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
