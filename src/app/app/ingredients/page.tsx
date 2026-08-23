import { requireBusinessContext } from "@/lib/context";
import { listIngredients } from "@/modules/catalog/ingredients";
import { IngredientManager } from "@/components/catalog/IngredientManager";

export default async function IngredientsPage() {
  const ctx = await requireBusinessContext();
  const ingredients = await listIngredients(ctx.activeBusiness.id, {
    includeInactive: true,
  });

  return (
    <IngredientManager
      initialIngredients={ingredients}
      currency={ctx.activeBusiness.currency}
    />
  );
}
