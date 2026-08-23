import { requireBusinessContext } from "@/lib/context";
import { generateBusinessReport } from "@/modules/reports/service";
import { thisMonthRange } from "@/modules/finance/dateRanges";
import { ReportsView } from "@/components/reports/ReportsView";

export default async function ReportsPage() {
  const ctx = await requireBusinessContext();
  const report = await generateBusinessReport(ctx.activeBusiness.id, thisMonthRange());

  return <ReportsView initialReport={report} currency={ctx.activeBusiness.currency} />;
}
