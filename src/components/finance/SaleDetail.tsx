"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { SaleWithItems } from "@/modules/sales/service";

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
}

export function SaleDetail({
  sale,
  currency,
}: {
  sale: SaleWithItems;
  currency: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [voiding, setVoiding] = useState(false);

  async function handleVoid() {
    setError(null);
    setVoiding(true);
    const res = await fetch(`/api/sales/${sale.id}/void`, { method: "POST" });
    setVoiding(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to void sale.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{sale.transactionNumber}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatDate(sale.transactionDate)}
            {sale.paymentMethod ? ` · ${sale.paymentMethod}` : ""}
            {" · "}
            <span className={sale.status === "completed" ? "text-emerald-700" : "text-slate-400"}>
              {sale.status}
            </span>
          </p>
        </div>
        {sale.status === "completed" && (
          <Button variant="danger" onClick={handleVoid} disabled={voiding}>
            {voiding ? "Voiding…" : "Void sale"}
          </Button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card>
        <h2 className="text-sm font-semibold text-slate-900">
          Items (historical snapshot — unaffected by later price or HPP changes)
        </h2>
        <table className="mt-4 w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
            <tr>
              <th className="py-2">Product</th>
              <th className="py-2">Qty</th>
              <th className="py-2">Price (at sale time)</th>
              <th className="py-2">HPP (at sale time)</th>
              <th className="py-2">Subtotal</th>
              <th className="py-2">Total HPP</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item) => (
              <tr key={item.id} className="border-b border-slate-50 last:border-0">
                <td className="py-2 font-medium text-slate-900">{item.productNameSnapshot}</td>
                <td className="py-2 text-slate-600">{item.quantity}</td>
                <td className="py-2 text-slate-900">
                  {formatCurrency(item.sellingPriceSnapshot, currency)}
                </td>
                <td className="py-2 text-slate-900">
                  {formatCurrency(item.hppSnapshot, currency)}
                </td>
                <td className="py-2 text-slate-900">{formatCurrency(item.subtotal, currency)}</td>
                <td className="py-2 text-slate-900">{formatCurrency(item.totalHpp, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-xs uppercase text-slate-400">Total revenue</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(sale.totalAmount, currency)}
          </p>
        </Card>
        <Card>
          <p className="text-xs uppercase text-slate-400">Total HPP</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {formatCurrency(sale.totalHpp, currency)}
          </p>
        </Card>
      </div>

      {sale.notes && (
        <Card>
          <h2 className="text-sm font-semibold text-slate-900">Notes</h2>
          <p className="mt-2 text-sm text-slate-600">{sale.notes}</p>
        </Card>
      )}
    </div>
  );
}
