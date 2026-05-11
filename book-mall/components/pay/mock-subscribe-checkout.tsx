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
import { formatMinorAsYuan } from "@/lib/currency";
import type { MockSubscribePlanSlug } from "@/lib/apply-mock-subscription";
import { FakeQrPlaceholder } from "@/components/pay/fake-qr-placeholder";

export function MockSubscribeCheckout({
  planSlug,
  planName,
  amountMinor,
  intervalLabel,
}: {
  planSlug: MockSubscribePlanSlug;
  planName: string;
  amountMinor: number;
  intervalLabel: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPaidClick() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/dev/mock-subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "开通失败，请稍后重试");
        return;
      }
      router.push("/account");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container max-w-lg mx-auto px-4 py-16 md:py-24">
      <Card>
        <CardHeader className="text-center space-y-1">
          <CardTitle>模拟收银（订阅）</CardTitle>
          <CardDescription>
            以下为过渡演示：二维码仅为占位，点击「支付成功」即等同付款完成并开通订阅。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 flex flex-col items-center">
          <div className="text-center space-y-1 w-full">
            <p className="font-semibold text-lg">{planName}</p>
            <p className="text-muted-foreground text-sm">{intervalLabel}套餐</p>
            <p className="text-3xl font-bold tabular-nums pt-2">
              ¥{formatMinorAsYuan(amountMinor)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <FakeQrPlaceholder size={196} />
            <p className="text-xs text-muted-foreground max-w-[240px] text-center leading-relaxed">
              真实渠道接入后将替换为收款码或跳转第三方支付页。
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
            <Button
              type="button"
              size="lg"
              className="min-w-[160px]"
              disabled={busy}
              onClick={onPaidClick}
            >
              {busy ? "处理中…" : "支付成功"}
            </Button>
            <Button type="button" variant="outline" size="lg" asChild>
              <Link href="/subscribe">返回订阅说明</Link>
            </Button>
          </div>

          {msg ? (
            <p className="text-sm text-destructive text-center w-full">{msg}</p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
