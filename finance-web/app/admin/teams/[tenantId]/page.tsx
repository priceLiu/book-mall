import { Suspense } from "react";
import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { AdminTeamDashboardClient } from "@/components/admin/admin-team-dashboard-client";
import { FinancePageState } from "@/components/finance-page-shell";

export const dynamic = "force-dynamic";

export default function AdminTeamDetailPage({ params }: { params: { tenantId: string } }) {
  return (
    <FinanceAdminGate require="viewCost">
      <Suspense fallback={<FinancePageState>加载中…</FinancePageState>}>
        <AdminTeamDashboardClient tenantId={params.tenantId} />
      </Suspense>
    </FinanceAdminGate>
  );
}
