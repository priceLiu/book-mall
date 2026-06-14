import { FinanceAdminGate } from "@/components/finance-admin-gate";
import { AdminTeamMemberDetailClient } from "@/components/admin/admin-team-member-detail-client";

export const dynamic = "force-dynamic";

export default function AdminTeamMemberDetailPage({
  params,
}: {
  params: { tenantId: string; userId: string };
}) {
  return (
    <FinanceAdminGate require="viewCost">
      <AdminTeamMemberDetailClient tenantId={params.tenantId} userId={params.userId} />
    </FinanceAdminGate>
  );
}
