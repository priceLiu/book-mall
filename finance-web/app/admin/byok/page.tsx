import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { ByokClient } from "@/components/admin/byok-client";

export const dynamic = "force-dynamic";

export default function ByokPage() {
  return (
    <FinanceAdminGate require="managePricing">
      <ByokClient />
    </FinanceAdminGate>
  );
}
