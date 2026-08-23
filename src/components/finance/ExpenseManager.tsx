"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { EXPENSE_CATEGORIES } from "@/modules/finance/categories";
import type { Expense } from "@/db/schema";
import { formatCurrency, formatDate } from "@/lib/format";

export function ExpenseManager({
  initialExpenses,
  currency,
}: {
  initialExpenses: Expense[];
  currency: string;
}) {
  const router = useRouter();
  const [expenses, setExpenses] = useState(initialExpenses);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/expenses");
    if (res.ok) {
      const data = await res.json();
      setExpenses(data.expenses);
    }
    router.refresh();
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(formData.get("amount")),
        category: formData.get("category"),
        description: formData.get("description") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add expense.");
      return;
    }
    setShowForm(false);
    await refresh();
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to delete expense.");
      return;
    }
    await refresh();
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Expenses</h1>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add expense"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {showForm && (
        <Card>
          <form action={handleAdd} className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" name="amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                name="category"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                defaultValue="other"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {expenses.length === 0 && !showForm ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No expenses recorded yet.
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{formatDate(e.transactionDate)}</td>
                    <td className="px-4 py-3 capitalize text-slate-900">{e.category}</td>
                    <td className="px-4 py-3 text-slate-600">{e.description ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {formatCurrency(e.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => handleDelete(e.id)}>
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
