import { requireBusinessContext } from "@/lib/context";
import { generateIntelligenceReport } from "@/modules/intelligence/engine";
import { thisMonthRange } from "@/modules/finance/dateRanges";
import { BusinessIntelligenceView } from "@/components/intelligence/BusinessIntelligenceView";

export default async function AnalysisPage() {
  const ctx = await requireBusinessContext();
  const report = await generateIntelligenceReport(ctx.activeBusiness.id, thisMonthRange());

  return <BusinessIntelligenceView initialReport={report} />;
}
