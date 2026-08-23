import { requireBusinessContext } from "@/lib/context";
import { listProducts } from "@/modules/catalog/products";
import { ProductManager } from "@/components/catalog/ProductManager";

export default async function ProductsPage() {
  const ctx = await requireBusinessContext();
  const products = await listProducts(ctx.activeBusiness.id, {
    includeInactive: true,
  });

  return (
    <ProductManager initialProducts={products} currency={ctx.activeBusiness.currency} />
  );
}
