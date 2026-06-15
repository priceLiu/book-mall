"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

/** 积分换算 1.0：续订走会员订阅，不再单独 BYOK Checkout。 */
export function ByokRenewButton({
  target,
}: {
  scopeKey?: string;
  target: "personal" | "team";
  tenantId?: string;
}) {
  const router = useRouter();

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => router.push(target === "team" ? "/pricing#team" : "/pricing#personal")}
    >
      续订会员
    </Button>
  );
}
