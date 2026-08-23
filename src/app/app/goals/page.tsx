import { requireBusinessContext } from "@/lib/context";
import { ComingSoon } from "@/components/layout/ComingSoon";

export default async function GoalsPage() {
  await requireBusinessContext();
  return <ComingSoon title="Goals" />;
}
