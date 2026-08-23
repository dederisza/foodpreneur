import { requireBusinessContext } from "@/lib/context";
import { listProducts } from "@/modules/catalog/products";
import { NewSaleForm } from "@/components/finance/NewSaleForm";

export default async function NewSalePage() {
  const ctx = await requireBusinessContext();
  const products = await listProducts(ctx.activeBusiness.id, { includeInactive: true });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Record a new sale</h1>
      <NewSaleForm products={products} currency={ctx.activeBusiness.currency} />
    </div>
  );
}
