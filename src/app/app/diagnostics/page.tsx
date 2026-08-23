import { requireBusinessContext } from "@/lib/context";
import { ComingSoon } from "@/components/layout/ComingSoon";

export default async function DiagnosticsPage() {
  await requireBusinessContext();
  return <ComingSoon title="Diagnostics" />;
}
