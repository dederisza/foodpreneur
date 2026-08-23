import { requireBusinessContext } from "@/lib/context";
import { listOwnerDrawings } from "@/modules/finance/drawings";
import { DrawingsManager } from "@/components/finance/DrawingsManager";

export default async function OwnerDrawingsPage() {
  const ctx = await requireBusinessContext();
  const drawings = await listOwnerDrawings(ctx.activeBusiness.id);

  return <DrawingsManager initialDrawings={drawings} currency={ctx.activeBusiness.currency} />;
}
