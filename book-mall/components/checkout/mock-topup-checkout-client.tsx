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

export function MockTopupCheckoutClient({
  packId,
  packLabel,
  credits,
  priceYuan,
}: {
  packId: string;
  packLabel: string;
  credits: number;
  priceYuan: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPaidClick() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/dev/mock-credit-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, target: "personal" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setMsg(data.error ?? "充值失败");
        return;
      }
      router.push("/account/billing?success=topup");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle>轻量包结账（模拟）</CardTitle>
        <CardDescription>{packLabel}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-lg">
          {credits.toLocaleString()} 积分 · ¥{priceYuan.toFixed(2)}
        </p>
        <FakeQrPlaceholder amountLabel={`¥${priceYuan.toFixed(2)}`} />
        {msg ? <p className="text-sm text-red-500">{msg}</p> : null}
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
