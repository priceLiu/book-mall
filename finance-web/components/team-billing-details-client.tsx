"use client";

import { useSearchParams } from "next/navigation";
import { BillDetailsClient } from "@/components/bill-details-client";

export function TeamBillingDetailsClient() {
  const searchParams = useSearchParams();
  const tenantId = searchParams.get("tenantId") ?? undefined;
  return <BillDetailsClient teamScope teamTenantId={tenantId} viewerRole="user" />;
}
