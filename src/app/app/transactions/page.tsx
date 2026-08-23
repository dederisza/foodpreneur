import { requireBusinessContext } from "@/lib/context";
import { listTransactionHistory } from "@/modules/finance/transactionHistory";
import { TransactionHistoryList } from "@/components/finance/TransactionHistoryList";

export default async function TransactionsPage() {
  const ctx = await requireBusinessContext();
  const transactions = await listTransactionHistory(ctx.activeBusiness.id);

  return (
    <TransactionHistoryList transactions={transactions} currency={ctx.activeBusiness.currency} />
  );
}
