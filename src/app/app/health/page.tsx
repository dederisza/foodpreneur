import { requireBusinessContext } from "@/lib/context";
import { ComingSoon } from "@/components/layout/ComingSoon";

export default async function HealthPage() {
  await requireBusinessContext();
  return <ComingSoon title="Business Health" />;
}
