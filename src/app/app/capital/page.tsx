import { requireBusinessContext } from "@/lib/context";
import { listCapitalTransactions } from "@/modules/finance/capital";
import { CapitalManager } from "@/components/finance/CapitalManager";

export default async function CapitalPage() {
  const ctx = await requireBusinessContext();
  const transactions = await listCapitalTransactions(ctx.activeBusiness.id);

  return (
    <CapitalManager initialTransactions={transactions} currency={ctx.activeBusiness.currency} />
  );
}
