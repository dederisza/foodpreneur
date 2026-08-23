"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type { Product } from "@/db/schema";
import { formatCurrency } from "@/lib/format";

export function ProductManager({
  initialProducts,
  currency,
}: {
  initialProducts: Product[];
  currency: string;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [showAddForm, setShowAddForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd(formData: FormData) {
    setError(null);
    const res = await fetch("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        description: formData.get("description") || undefined,
        category: formData.get("category") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add product.");
      return;
    }
    setShowAddForm(false);
    const refreshed = await fetch("/api/products");
    if (refreshed.ok) {
      const d = await refreshed.json();
      setProducts(d.products);
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Products</h1>
        <Button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add product"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {showAddForm && (
        <Card>
          <form action={handleAdd} className="space-y-4">
            <div>
              <Label htmlFor="name">Product name</Label>
              <Input id="name" name="name" required placeholder="e.g. Chicken Burger" />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="category">Category (optional)</Label>
                <Input id="category" name="category" placeholder="e.g. Main" />
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Input id="description" name="description" placeholder="Short description" />
              </div>
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {products.length === 0 && !showAddForm ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No products yet. Add your first product to start building its recipe and HPP.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Current HPP</th>
                <th className="px-4 py-3">Selling price</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.name}</td>
                  <td className="px-4 py-3 text-slate-600">{p.category ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-900">
                    {formatCurrency(p.currentHpp, currency)}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {formatCurrency(p.currentSellingPrice, currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {p.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/app/products/${p.id}`}>
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
