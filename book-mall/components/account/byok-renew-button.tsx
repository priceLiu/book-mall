"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ByokRenewButton({
  scopeKey,
  target,
  tenantId,
}: {
  scopeKey: string;
  target: "personal" | "team";
  tenantId?: string;
}) {
  const router = useRouter();

  function renew() {
    const params = new URLSearchParams({ scope: scopeKey });
    if (target === "team" && tenantId) {
      params.set("tenantId", tenantId);
    }
    router.push(`/checkout/byok?${params.toString()}`);
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={renew}>
      续订一个月
    </Button>
  );
}
