"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";

import { WechatPersonalCheckout } from "@/components/pay/wechat-personal-checkout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { canUseAdminInstantCheckout } from "@/lib/payments/session-auth-client";

export function ByokCheckoutClient({
  scopeKey,
  label,
  techServiceFeeYuan,
  isTeamScope,
  teamTenants,
  minSeats,
}: {
  scopeKey: string;
  label: string;
  techServiceFeeYuan: number;
  isTeamScope: boolean;
  teamTenants: { id: string; name: string }[];
  minSeats: number | null;
}) {
  const { data: session } = useSession();
  const adminInstant = canUseAdminInstantCheckout(session?.user?.role);
  const [tenantId, setTenantId] = useState(teamTenants[0]?.id ?? "");

  const priceHint = isTeamScope
    ? `¥${techServiceFeeYuan}/席/月${minSeats ? `（${minSeats} 席起）` : ""}`
    : `¥${techServiceFeeYuan}/月`;

  const createPayload = isTeamScope
    ? {
        productKind: "BYOK_TEAM" as const,
        scopeKey,
        tenantId,
      }
    : { productKind: "BYOK_PERSONAL" as const, scopeKey };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{adminInstant ? "BYOK 套餐结账（管理员）" : "BYOK 套餐结账"}</CardTitle>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg font-semibold">{priceHint}</p>
        {isTeamScope && teamTenants.length > 0 ? (
          <select
            className="w-full rounded-md border px-2 py-1.5 text-sm"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
          >
            {teamTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        ) : null}
        {isTeamScope && !tenantId ? (
          <p className="text-sm text-red-500">请先创建团队</p>
        ) : (
          <WechatPersonalCheckout
            createPayload={createPayload}
            adminInstant={adminInstant}
            successRedirect="/account/byok?success=1"
          />
        )}
        <Button variant="outline" className="w-full" asChild>
          <Link href="/pricing">返回定价页</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
