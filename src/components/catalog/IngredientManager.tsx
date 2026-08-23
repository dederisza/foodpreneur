"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { BASE_UNITS } from "@/modules/catalog/units";
import type { Ingredient } from "@/db/schema";
import { formatCurrency } from "@/lib/format";

export function IngredientManager({
  initialIngredients,
  currency,
}: {
  initialIngredients: Ingredient[];
  currency: string;
}) {
  const router = useRouter();
  const [ingredients, setIngredients] = useState(initialIngredients);
  const [showAddForm, setShowAddForm] = useState(false);
  const [costEditId, setCostEditId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/ingredients");
    if (res.ok) {
      const data = await res.json();
      setIngredients(data.ingredients);
    }
    router.refresh();
  }

  async function handleAdd(formData: FormData) {
    setError(null);
    const res = await fetch("/api/ingredients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        baseUnit: formData.get("baseUnit"),
        initialCost: Number(formData.get("initialCost")),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to add ingredient.");
      return;
    }
    setShowAddForm(false);
    await refresh();
  }

  async function handleToggleActive(ingredient: Ingredient) {
    setError(null);
    const res = await fetch(`/api/ingredients/${ingredient.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !ingredient.isActive }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to update ingredient.");
      return;
    }
    await refresh();
  }

  async function handleCostChange(ingredientId: string, formData: FormData) {
    setError(null);
    const res = await fetch(`/api/ingredients/${ingredientId}/cost`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        costPerBaseUnit: Number(formData.get("costPerBaseUnit")),
        notes: formData.get("notes") || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to update cost.");
      return;
    }
    setCostEditId(null);
    await refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">Ingredients</h1>
        <Button onClick={() => setShowAddForm((v) => !v)}>
          {showAddForm ? "Cancel" : "+ Add ingredient"}
        </Button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {showAddForm && (
        <Card>
          <form
            action={handleAdd}
            className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end"
          >
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required placeholder="e.g. Chicken Breast" />
            </div>
            <div>
              <Label htmlFor="baseUnit">Base unit</Label>
              <select
                id="baseUnit"
                name="baseUnit"
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm"
                defaultValue="gram"
              >
                {BASE_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="initialCost">Cost per unit</Label>
              <Input
                id="initialCost"
                name="initialCost"
                type="number"
                step="0.01"
                min="0"
                required
                placeholder="0"
              />
            </div>
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {ingredients.length === 0 && !showAddForm ? (
        <Card className="border-dashed text-center text-sm text-slate-500">
          No ingredients yet. Add your first ingredient to get started.
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Base unit</th>
                <th className="px-4 py-3">Current cost</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => (
                <tr key={ing.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-900">{ing.name}</td>
                  <td className="px-4 py-3 text-slate-600">{ing.baseUnit}</td>
                  <td className="px-4 py-3 text-slate-900">
                    {formatCurrency(ing.currentCost, currency)}
                    <span className="text-slate-400"> / {ing.baseUnit}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        ing.isActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {ing.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setCostEditId(costEditId === ing.id ? null : ing.id)
                      }
                    >
                      Update cost
                    </Button>
                    <Button variant="ghost" onClick={() => handleToggleActive(ing)}>
                      {ing.isActive ? "Deactivate" : "Reactivate"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {costEditId && (
            <div className="border-t border-slate-100 bg-slate-50 p-4">
              <form
                action={(fd) => handleCostChange(costEditId, fd)}
                className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end"
              >
                <div>
                  <Label htmlFor="costPerBaseUnit">New cost</Label>
                  <Input
                    id="costPerBaseUnit"
                    name="costPerBaseUnit"
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Input id="notes" name="notes" placeholder="e.g. supplier price increase" />
                </div>
                <Button type="submit">Save new cost</Button>
              </form>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
