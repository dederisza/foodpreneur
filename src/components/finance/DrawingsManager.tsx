"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { OwnerDrawing } from "@/db/schema";
import { formatCurrency, formatDate } from "@/lib/format";

export function DrawingsManager({
  initialDrawings,
  currency,
}: {
  initialDrawings: OwnerDrawing[];
  currency: string;
}) {
  const router = useRouter();
  const [drawings, setDrawings] = useState(initialDrawings);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/owner-drawings");
    if (res.ok) {
      const data = await res.json();
      setDrawings(data.ownerDrawings);
    }
    router.refresh();
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    const res = await fetch("/api/owner-drawings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Number(formData.get("amount")),
        notes: formData.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add drawing.");
      return;
    }
    setShowForm(false);
    await refresh();
  }

  async function handleDelete(id: string) {
    setError(null);
    const res = await fetch(`/api/owner-drawings/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to delete.");
      return;
    }
    await refresh();
  }

  const total = drawings.reduce((sum, d) => sum + d.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Owner Drawings</h1>
          <p className="text-sm text-slate-500">
            Money taken out of the business by the owner. Not counted as an
            operating expense.
          </p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Cancel" : "+ Add drawing"}
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
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input id="notes" name="notes" />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {drawings.length === 0 && !showForm ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No owner drawings recorded yet.
        </Card>
      ) : (
        <>
          <Card className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Notes</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {drawings.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-slate-600">{formatDate(d.transactionDate)}</td>
                    <td className="px-4 py-3 text-slate-600">{d.notes ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-900">
                      {formatCurrency(d.amount, currency)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button variant="ghost" onClick={() => handleDelete(d.id)}>
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
