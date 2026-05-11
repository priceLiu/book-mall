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
import {
  MOCK_TOPUP_PRESETS,
  type MockTopupAmountMinor,
} from "@/lib/apply-mock-topup";
import { FakeQrPlaceholder } from "@/components/pay/fake-qr-placeholder";

const LABELS: Record<MockTopupAmountMinor, string> = {
  [50_00]: "¥50",
  [100_00]: "¥100",
  [200_00]: "¥200",
};

export function MockTopupCheckout({ initialAmountMinor }: { initialAmountMinor: MockTopupAmountMinor }) {
  const [amountMinor, setAmountMinor] = useState<MockTopupAmountMinor>(initialAmountMinor);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function onPaidClick() {
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/dev/mock-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountMinor }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(typeof data.error === "string" ? data.error : "充值失败，请稍后重试");
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
          <CardTitle>模拟收银（钱包充值）</CardTitle>
          <CardDescription>
            高级能力需「订阅有效 + 余额不低于最低线」。以下为过渡演示：占位二维码 +「支付成功」等同到账。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 w-full">
            {MOCK_TOPUP_PRESETS.map((minor) => (
              <Button
                key={minor}
                type="button"
                variant={amountMinor === minor ? "default" : "outline"}
                size="sm"
                onClick={() => setAmountMinor(minor)}
              >
                {LABELS[minor]}
              </Button>
            ))}
          </div>

          <div className="text-center space-y-1 w-full">
            <p className="font-semibold text-lg">充值到账金额</p>
            <p className="text-3xl font-bold tabular-nums pt-2">
              ¥{formatMinorAsYuan(amountMinor)}
            </p>
          </div>

          <div className="flex flex-col items-center gap-3">
            <FakeQrPlaceholder size={196} />
            <p className="text-xs text-muted-foreground max-w-[260px] text-center leading-relaxed">
              接入真实支付后替换为收款码或跳转收银台；到账逻辑仍可复用当前服务端入账接口。
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
              <Link href="/account">返回个人中心</Link>
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
