import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/lib/context";
import { getOwnedProductOrThrow } from "@/modules/catalog/products";
import { listRecipeForProduct } from "@/modules/catalog/recipes";
import { listIngredients } from "@/modules/catalog/ingredients";
import { calculateCurrentHpp } from "@/modules/costing/hpp";
import { listCostVersionHistory } from "@/modules/costing/service";
import { listSellingPriceHistory } from "@/modules/pricing/service";
import { OwnershipError } from "@/modules/business/service";
import { ProductDetail } from "@/components/catalog/ProductDetail";

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireBusinessContext();
  const { id } = await params;

  let data: {
    product: Awaited<ReturnType<typeof getOwnedProductOrThrow>>;
    recipe: Awaited<ReturnType<typeof listRecipeForProduct>>;
    hpp: Awaited<ReturnType<typeof calculateCurrentHpp>>;
    costVersions: Awaited<ReturnType<typeof listCostVersionHistory>>;
    priceHistory: Awaited<ReturnType<typeof listSellingPriceHistory>>;
    availableIngredients: Awaited<ReturnType<typeof listIngredients>>;
  };

  try {
    const product = await getOwnedProductOrThrow(ctx.activeBusiness.id, id);
    const [recipe, hpp, costVersions, priceHistory, availableIngredients] =
      await Promise.all([
        listRecipeForProduct(ctx.activeBusiness.id, id),
        calculateCurrentHpp(ctx.activeBusiness.id, id),
        listCostVersionHistory(ctx.activeBusiness.id, id),
        listSellingPriceHistory(ctx.activeBusiness.id, id),
        listIngredients(ctx.activeBusiness.id),
      ]);
    data = { product, recipe, hpp, costVersions, priceHistory, availableIngredients };
  } catch (err) {
    if (err instanceof OwnershipError) {
      notFound();
    }
    throw err;
  }

  return (
    <ProductDetail
      product={data.product}
      recipe={data.recipe}
      hpp={data.hpp}
      costVersions={data.costVersions}
      priceHistory={data.priceHistory}
      availableIngredients={data.availableIngredients}
      currency={ctx.activeBusiness.currency}
    />
  );
}
