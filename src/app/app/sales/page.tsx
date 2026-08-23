import { requireBusinessContext } from "@/lib/context";
import { listSales } from "@/modules/sales/service";
import { SalesList } from "@/components/finance/SalesList";

export default async function SalesPage() {
  const ctx = await requireBusinessContext();
  const sales = await listSales(ctx.activeBusiness.id);

  return <SalesList initialSales={sales} currency={ctx.activeBusiness.currency} />;
}
