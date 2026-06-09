"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FakeQrPlaceholder } from "@/components/pay/fake-qr-placeholder";

export function MockMembershipCheckoutClient({
  planId,
  planLabel,
  priceYuan,
  seats,
  isTeam,
}: {
  planId: string;
  planLabel: string;
  priceYuan: number;
  seats?: number;
  isTeam?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function onPaidClick() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/dev/mock-membership-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          seats: isTeam ? seats : undefined,
          teamName: isTeam ? teamName || undefined : undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "开通失败，请稍后重试");
        return;
      }
      router.push(isTeam ? "/account/team?success=1" : "/account/billing?success=membership");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>会员套餐结账（模拟）</CardTitle>
        <CardDescription>{planLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-2xl font-semibold">¥{priceYuan.toFixed(2)}</p>
        {isTeam && seats ? (
          <p className="text-sm text-muted-foreground">席位数：{seats}</p>
        ) : null}
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
        <FakeQrPlaceholder amountLabel={`¥${priceYuan.toFixed(2)}`} />
        {msg ? (
          <p className="text-sm text-red-500" role="alert">
            {msg}
          </p>
        ) : null}
        <Button className="w-full" disabled={busy} onClick={() => void onPaidClick()}>
          {busy ? "处理中…" : "模拟支付成功"}
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/pricing">返回定价页</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
