import { requireBusinessContext } from "@/lib/context";
import { calculateFinancialSummary } from "@/modules/finance/summary";
import { thisMonthRange } from "@/modules/finance/dateRanges";
import { FinancialSummaryView } from "@/components/finance/FinancialSummaryView";

export default async function ActivityPage() {
  const ctx = await requireBusinessContext();
  const summary = await calculateFinancialSummary(ctx.activeBusiness.id, thisMonthRange());

  return <FinancialSummaryView initialSummary={summary} currency={ctx.activeBusiness.currency} />;
}
