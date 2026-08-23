import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/lib/context";
import { getOwnedSaleOrThrow } from "@/modules/sales/service";
import { OwnershipError } from "@/modules/business/service";
import { SaleDetail } from "@/components/finance/SaleDetail";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireBusinessContext();
  const { id } = await params;

  let sale: Awaited<ReturnType<typeof getOwnedSaleOrThrow>>;
  try {
    sale = await getOwnedSaleOrThrow(ctx.activeBusiness.id, id);
  } catch (err) {
    if (err instanceof OwnershipError) notFound();
    throw err;
  }

  return <SaleDetail sale={sale} currency={ctx.activeBusiness.currency} />;
}
