"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Product } from "@/db/schema";
import { formatCurrency } from "@/lib/format";

type Line = { productId: string; quantity: number };

export function NewSaleForm({
  products,
  currency,
}: {
  products: Product[];
  currency: string;
}) {
  const router = useRouter();
  const sellableProducts = products.filter((p) => p.isActive && p.currentSellingPrice !== null);

  const [lines, setLines] = useState<Line[]>(
    sellableProducts.length > 0 ? [{ productId: sellableProducts[0].id, quantity: 1 }] : []
  );
  const [paymentMethod, setPaymentMethod] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function addLine() {
    if (sellableProducts.length === 0) return;
    setLines((prev) => [...prev, { productId: sellableProducts[0].id, quantity: 1 }]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function lineSubtotal(line: Line): number {
    const product = sellableProducts.find((p) => p.id === line.productId);
    if (!product || product.currentSellingPrice === null) return 0;
    return product.currentSellingPrice * line.quantity;
  }

  const total = lines.reduce((sum, l) => sum + lineSubtotal(l), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (lines.length === 0) {
      setError("Add at least one product to the sale.");
      return;
    }

    setLoading(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
        paymentMethod: paymentMethod || undefined,
        notes: notes || undefined,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Failed to record sale.");
      return;
    }

    router.push(`/app/sales/${data.sale.id}`);
    router.refresh();
  }

  if (sellableProducts.length === 0) {
    return (
      <Card className="border-dashed text-center text-sm text-slate-500">
        No products are ready to sell yet. A product needs an active status
        and a selling price before it can appear in a sale — set those on
        the product detail page first.
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <Card className="space-y-3">
        {lines.map((line, i) => {
          const product = sellableProducts.find((p) => p.id === line.productId);
          return (
            <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
              <div>
                <Label htmlFor={`product-${i}`}>Product</Label>
                <select
                  id={`product-${i}`}
                  value={line.productId}
                  onChange={(e) => updateLine(i, { productId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                >
                  {sellableProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({formatCurrency(p.currentSellingPrice ?? 0, currency)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor={`qty-${i}`}>Quantity</Label>
                <Input
                  id={`qty-${i}`}
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                />
              </div>
              <div>
                <p className="mb-1.5 text-sm font-medium text-slate-700">Subtotal</p>
                <p className="rounded-lg border border-transparent px-3.5 py-2.5 text-sm font-medium text-slate-900">
                  {formatCurrency(lineSubtotal(line), currency)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => removeLine(i)}
                disabled={lines.length === 1}
              >
                Remove
              </Button>
              {!product && <p className="text-xs text-red-600">Product unavailable</p>}
            </div>
          );
        })}

        <Button type="button" variant="secondary" onClick={addLine}>
          + Add another product
        </Button>
      </Card>

      <Card className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="paymentMethod">Payment method (optional)</Label>
          <Input
            id="paymentMethod"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
            placeholder="e.g. cash, QRIS"
          />
        </div>
        <div>
          <Label htmlFor="notes">Notes (optional)</Label>
          <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>

      <Card className="flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-900">Total</span>
        <span className="text-xl font-semibold text-slate-900">
          {formatCurrency(total, currency)}
        </span>
      </Card>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Recording sale…" : "Record sale"}
      </Button>
    </form>
  );
}
