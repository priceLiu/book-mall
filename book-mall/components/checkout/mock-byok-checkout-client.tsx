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

export function MockByokCheckoutClient({
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
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState(teamTenants[0]?.id ?? "");

  async function subscribe() {
    if (isTeamScope && !tenantId) {
      setMessage("请先创建团队");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/dev/mock-byok-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scopeKey,
          target: isTeamScope ? "team" : "personal",
          tenantId: isTeamScope ? tenantId : undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "开通失败");
      router.push("/account/byok?success=1");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "开通失败");
    } finally {
      setLoading(false);
    }
  }

  const priceHint = isTeamScope
    ? `¥${techServiceFeeYuan}/席/月${minSeats ? `（${minSeats} 席起）` : ""}`
    : `¥${techServiceFeeYuan}/月`;

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>BYOK 套餐结账（模拟）</CardTitle>
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
        <FakeQrPlaceholder amountLabel={priceHint} />
        {message ? <p className="text-sm text-red-500">{message}</p> : null}
        <Button className="w-full" disabled={loading} onClick={() => void subscribe()}>
          {loading ? "处理中…" : "模拟支付成功"}
        </Button>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/pricing">返回定价页</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
