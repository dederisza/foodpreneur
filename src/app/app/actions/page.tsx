import { requireBusinessContext } from "@/lib/context";
import { ComingSoon } from "@/components/layout/ComingSoon";

export default async function ActionsPage() {
  await requireBusinessContext();
  return <ComingSoon title="Priority Actions" />;
}
