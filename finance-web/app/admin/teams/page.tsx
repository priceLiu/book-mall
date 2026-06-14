import { Suspense } from "react";
import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { AdminTeamsClient } from "@/components/admin/admin-teams-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function AdminTeamsPage() {
  return (
    <FinanceAdminGate require="viewCost">
      <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
        <AdminTeamsClient />
      </Suspense>
    </FinanceAdminGate>
  );
}
