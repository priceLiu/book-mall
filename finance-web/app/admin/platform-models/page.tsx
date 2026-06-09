import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { PlatformModelsClient } from "@/components/admin/platform-models-client";

export const dynamic = "force-dynamic";

export default function PlatformModelsPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <PlatformModelsClient />
    </FinanceAdminGate>
  );
}
