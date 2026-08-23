import { requireBusinessContext } from "@/lib/context";
import { listExpenses } from "@/modules/finance/expenses";
import { ExpenseManager } from "@/components/finance/ExpenseManager";

export default async function ExpensesPage() {
  const ctx = await requireBusinessContext();
  const expenses = await listExpenses(ctx.activeBusiness.id);

  return <ExpenseManager initialExpenses={expenses} currency={ctx.activeBusiness.currency} />;
}
