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

export function MembershipCheckoutClient({
  planId,
  planLabel,
  seats,
  isTeam,
}: {
  planId: string;
  planLabel: string;
  priceYuan: number;
  seats?: number;
  isTeam?: boolean;
}) {
  const { data: session } = useSession();
  const adminInstant = canUseAdminInstantCheckout(session?.user?.role);
  const [teamName, setTeamName] = useState("");

  const createPayload = isTeam
    ? {
        productKind: "MEMBERSHIP_TEAM" as const,
        planId,
        seats,
        teamName: teamName || undefined,
      }
    : { productKind: "MEMBERSHIP_PERSONAL" as const, planId };

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{adminInstant ? "会员套餐结账（管理员）" : "会员套餐结账"}</CardTitle>
        <CardDescription>{planLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isTeam ? (
          <label className="block text-sm">
            团队名称（新建团队时）
            <input
              className="mt-1 w-full rounded border px-2 py-1.5"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="我的团队"
            />
          </label>
        ) : null}
        {isTeam && seats ? (
          <p className="text-sm text-muted-foreground">席位数：{seats}</p>
        ) : null}
        <WechatPersonalCheckout
          createPayload={createPayload}
          adminInstant={adminInstant}
          successRedirect={
            isTeam ? "/account/team?success=1" : "/account/billing?success=membership"
          }
        />
        <Button variant="outline" className="w-full" asChild>
          <Link href="/pricing">返回定价页</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
