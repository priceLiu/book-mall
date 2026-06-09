"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

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

export function TopupCheckoutClient({
  packId,
  packLabel,
  credits,
  priceYuan,
  target = "personal",
  tenantId,
}: {
  packId: string;
  packLabel: string;
  credits: number;
  priceYuan: number;
  target?: "personal" | "team";
  tenantId?: string;
}) {
  const { data: session } = useSession();
  const adminInstant = canUseAdminInstantCheckout(session?.user?.role);

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>{adminInstant ? "轻量包结账（管理员）" : "轻量包结账"}</CardTitle>
        <CardDescription>{packLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg">
          {credits.toLocaleString()} 积分 · ¥{priceYuan.toFixed(2)}
        </p>
        <WechatPersonalCheckout
          createPayload={{
            productKind: "CREDIT_TOPUP",
            packId,
            target,
            tenantId,
          }}
          adminInstant={adminInstant}
          successRedirect="/account/billing?success=topup"
        />
        <Button variant="outline" className="w-full" asChild>
          <Link href="/pricing">返回定价页</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
