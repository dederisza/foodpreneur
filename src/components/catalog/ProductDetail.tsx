"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import type {
  Product,
  Ingredient,
  ProductCostVersion,
  SellingPriceHistory,
} from "@/db/schema";
import type { RecipeLine } from "@/modules/catalog/recipes";
import type { HppResult } from "@/modules/costing/hpp";
import { formatCurrency, formatDateTime as formatDate } from "@/lib/format";

export function ProductDetail({
  product,
  recipe,
  hpp,
  costVersions,
  priceHistory,
  availableIngredients,
  currency,
}: {
  product: Product;
  recipe: RecipeLine[];
  hpp: HppResult;
  costVersions: ProductCostVersion[];
  priceHistory: SellingPriceHistory[];
  availableIngredients: Ingredient[];
  currency: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showAddIngredient, setShowAddIngredient] = useState(false);
  const [showPriceForm, setShowPriceForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  const activeIngredients = availableIngredients.filter((i) => i.isActive);
  const usedIngredientIds = new Set(recipe.map((r) => r.ingredientId));
  const selectableIngredients = activeIngredients.filter(
    (i) => !usedIngredientIds.has(i.id)
  );

  async function refresh() {
    router.refresh();
  }

  async function handleAddIngredient(formData: FormData) {
    setError(null);
    const res = await fetch(`/api/products/${product.id}/recipe`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ingredientId: formData.get("ingredientId"),
        quantity: Number(formData.get("quantity")),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add ingredient to recipe.");
      return;
    }
    setShowAddIngredient(false);
    await refresh();
  }

  async function handleUpdateQuantity(recipeItemId: string, quantity: number) {
    setError(null);
    const res = await fetch(`/api/products/${product.id}/recipe/${recipeItemId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quantity }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to update quantity.");
      return;
    }
    await refresh();
  }

  async function handleRemoveIngredient(recipeItemId: string) {
    setError(null);
    const res = await fetch(`/api/products/${product.id}/recipe/${recipeItemId}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to remove ingredient.");
      return;
    }
    await refresh();
  }

  async function handlePriceChange(formData: FormData) {
    setError(null);
    const res = await fetch(`/api/products/${product.id}/price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sellingPrice: Number(formData.get("sellingPrice")),
        notes: formData.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to update selling price.");
      return;
    }
    setShowPriceForm(false);
    await refresh();
  }

  async function handleRecalculate() {
    setError(null);
    setRecalculating(true);
    const res = await fetch(`/api/products/${product.id}/hpp`, { method: "POST" });
    setRecalculating(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to recalculate HPP.");
      return;
    }
    await refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{product.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {product.category ?? "Uncategorized"}
          {product.description ? ` · ${product.description}` : ""}
          {" · "}
          <span
            className={product.isActive ? "text-emerald-700" : "text-slate-400"}
          >
            {product.isActive ? "Active" : "Inactive"}
          </span>
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Current Selling Price */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Current selling price</h2>
            <Button variant="secondary" onClick={() => setShowPriceForm((v) => !v)}>
              {showPriceForm ? "Cancel" : "Update price"}
            </Button>
          </div>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {formatCurrency(product.currentSellingPrice, currency)}
          </p>
          {priceHistory[0] && (
            <p className="mt-1 text-xs text-slate-400">
              Effective from {formatDate(priceHistory[0].effectiveFrom)}
            </p>
          )}
          {showPriceForm && (
            <form action={handlePriceChange} className="mt-4 space-y-3">
              <div>
                <Label htmlFor="sellingPrice">New selling price</Label>
                <Input
                  id="sellingPrice"
                  name="sellingPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="notes">Notes (optional)</Label>
                <Input id="notes" name="notes" placeholder="Reason for the change" />
              </div>
              <Button type="submit">Save price</Button>
            </form>
          )}
        </Card>

        {/* Current HPP */}
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Current HPP</h2>
            <Button variant="secondary" onClick={handleRecalculate} disabled={recalculating}>
              {recalculating ? "Recalculating…" : "Recalculate"}
            </Button>
          </div>
          {hpp.status === "ok" && (
            <>
              <p className="mt-3 text-2xl font-semibold text-slate-900">
                {formatCurrency(hpp.totalCost, currency)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Calculated {formatDate(hpp.calculatedAt)}
              </p>
            </>
          )}
          {hpp.status === "no_recipe" && (
            <p className="mt-3 text-sm text-slate-500">
              This product has no recipe yet, so HPP can&apos;t be calculated. Add
              ingredients to the recipe below.
            </p>
          )}
          {hpp.status === "missing_cost_data" && (
            <p className="mt-3 text-sm text-amber-700">
              HPP can&apos;t be calculated: missing cost data for{" "}
              {hpp.missingIngredientNames.join(", ")}.
            </p>
          )}
        </Card>
      </div>

      {/* Recipe */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recipe</h2>
          <Button
            variant="secondary"
            onClick={() => setShowAddIngredient((v) => !v)}
            disabled={selectableIngredients.length === 0 && !showAddIngredient}
          >
            {showAddIngredient ? "Cancel" : "+ Add ingredient"}
          </Button>
        </div>

        {showAddIngredient && (
          <form
            action={handleAddIngredient}
            className="mt-4 grid grid-cols-1 gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3 sm:items-end"
          >
            <div>
              <Label htmlFor="ingredientId">Ingredient</Label>
              <select
                id="ingredientId"
                name="ingredientId"
                required
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
              >
                {selectableIngredients.map((ing) => (
                  <option key={ing.id} value={ing.id}>
                    {ing.name} ({ing.baseUnit})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                name="quantity"
                type="number"
                step="0.01"
                min="0.01"
                required
              />
            </div>
            <Button type="submit">Add to recipe</Button>
          </form>
        )}

        {recipe.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No ingredients in this recipe yet.
          </p>
        ) : (
          <table className="mt-4 w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="py-2">Ingredient</th>
                <th className="py-2">Quantity</th>
                <th className="py-2">Cost contribution</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {recipe.map((item) => {
                const lineItem =
                  hpp.status === "ok"
                    ? hpp.lineItems.find((li) => li.ingredientId === item.ingredientId)
                    : undefined;
                return (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2 font-medium text-slate-900">
                      {item.ingredientName}
                    </td>
                    <td className="py-2 text-slate-600">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        defaultValue={item.quantity}
                        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm"
                        onBlur={(e) => {
                          const val = Number(e.target.value);
                          if (val > 0 && val !== item.quantity) {
                            handleUpdateQuantity(item.id, val);
                          }
                        }}
                      />{" "}
                      {item.ingredientBaseUnit}
                    </td>
                    <td className="py-2 text-slate-900">
                      {lineItem
                        ? formatCurrency(lineItem.contribution, currency)
                        : "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Button
                        variant="ghost"
                        onClick={() => handleRemoveIngredient(item.id)}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {/* Historical information */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Historical information</h2>
          <Button variant="ghost" onClick={() => setShowHistory((v) => !v)}>
            {showHistory ? "Hide" : "Show"}
          </Button>
        </div>

        {showHistory && (
          <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-400">
                HPP versions
              </h3>
              {costVersions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No HPP version history yet.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {costVersions.map((v) => (
                    <li key={v.id} className="text-sm">
                      <span className="font-medium text-slate-900">
                        {formatCurrency(v.totalCost, currency)}
                      </span>{" "}
                      <span className="text-slate-400">
                        from {formatDate(v.effectiveFrom)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase text-slate-400">
                Selling price history
              </h3>
              {priceHistory.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  No selling price history yet.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {priceHistory.map((p) => (
                    <li key={p.id} className="text-sm">
                      <span className="font-medium text-slate-900">
                        {formatCurrency(p.sellingPrice, currency)}
                      </span>{" "}
                      <span className="text-slate-400">
                        from {formatDate(p.effectiveFrom)}
                      </span>
                      {p.notes && (
                        <span className="text-slate-400"> — {p.notes}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
