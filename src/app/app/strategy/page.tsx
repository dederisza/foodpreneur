import { requireBusinessContext } from "@/lib/context";
import { generateAiSynthesis } from "@/modules/ai/synthesis";
import { thisMonthRange } from "@/modules/finance/dateRanges";
import { AiStrategyView } from "@/components/ai/AiStrategyView";

export default async function StrategyPage() {
  const ctx = await requireBusinessContext();
  const result = await generateAiSynthesis(ctx.activeBusiness.id, thisMonthRange());

  return <AiStrategyView initialResult={result} />;
}
