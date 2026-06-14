"use client";

import { useSearchParams } from "next/navigation";
import { BillDetailsClient } from "@/components/bill-details-client";

export function AdminTeamBillingDetailsClient({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams();
  const actorUserId = searchParams.get("actorUserId") ?? undefined;
  return (
    <BillDetailsClient
      adminTeamTenantId={tenantId}
      teamActorUserId={actorUserId}
      viewerRole="admin"
    />
  );
}
