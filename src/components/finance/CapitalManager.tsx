"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { CapitalTransaction } from "@/db/schema";
import { formatCurrency, formatDate } from "@/lib/format";

export function CapitalManager({
  initialTransactions,
  currency,
}: {
  initialTransactions: CapitalTransaction[];
  currency: string;
}) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/capital");
    if (res.ok) {
      const data = await res.json();
      setTransactions(data.capitalTransactions);
    }
    router.refresh();
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    const res = await fetch("/api/capital", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(formData.get("amount")),
        source: formData.get("source") || undefined,
        notes: formData.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add capital.");
      return;
    }
    setShowForm(false);
    await refresh();
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/capital/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to delete.");
      return;
    }
    await refresh();
  }

  const total = transactions.reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Capital</h1>
          <p className="text-sm text-slate-500">
            Money injected into the business. Not counted as revenue.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add capital"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {showForm && (
        <Card>
          <form action={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div>
              <Label htmlFor="source">Source (optional)</Label>
              <Input id="source" name="source" placeholder="e.g. owner capital" />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {transactions.length === 0 && !showForm ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No capital transactions recorded yet.
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{formatDate(c.transactionDate)}</td>
                    <td className="px-4 py-3 text-slate-900">{c.source ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {formatCurrency(c.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => handleDelete(c.id)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-right text-sm text-slate-500">
            Total: <span className="font-semibold text-slate-900">{formatCurrency(total, currency)}</span>
          </p>
        </>
      )}
    </div>
  );
}
