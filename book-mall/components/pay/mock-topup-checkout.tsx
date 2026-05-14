"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatMinorAsYuan } from "@/lib/currency";
import {
  MOCK_TOPUP_CUSTOM_MAX_MINOR,
  MOCK_TOPUP_CUSTOM_MIN_MINOR,
  MOCK_TOPUP_PRESETS,
  isAllowedMockTopupAmountMinor,
} from "@/lib/apply-mock-topup";
import { FakeQrPlaceholder } from "@/components/pay/fake-qr-placeholder";

const PRESETS = MOCK_TOPUP_PRESETS as readonly number[];

const CUSTOM_MIN_YUAN = MOCK_TOPUP_CUSTOM_MIN_MINOR / 100;
const CUSTOM_MAX_YUAN = MOCK_TOPUP_CUSTOM_MAX_MINOR / 100;

function parseIntegerYuan(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || !/^\d+$/.test(t)) return null;
  const y = Number.parseInt(t, 10);
  return Number.isNaN(y) ? null : y;
}

function initialCustomYuanField(amountMinor: number): string {
  if (PRESETS.includes(amountMinor)) return "";
  if (
    amountMinor >= MOCK_TOPUP_CUSTOM_MIN_MINOR &&
    amountMinor <= MOCK_TOPUP_CUSTOM_MAX_MINOR &&
    amountMinor % 100 === 0
  ) {
    return String(amountMinor / 100);
  }
  return "";
}

export function MockTopupCheckout({ initialAmountMinor }: { initialAmountMinor: number }) {
  const [amountMinor, setAmountMinor] = useState(initialAmountMinor);
  const [customYuan, setCustomYuan] = useState(() => initialCustomYuanField(initialAmountMinor));
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const customYuanNum = parseIntegerYuan(customYuan);
  const customInvalid =
    customYuan.trim() !== "" &&
    (customYuanNum === null || customYuanNum < CUSTOM_MIN_YUAN || customYuanNum > CUSTOM_MAX_YUAN);

  const applyCustomYuan = useCallback((raw: string) => {
    setCustomYuan(raw);
    const y = parseIntegerYuan(raw);
    if (y !== null && y >= CUSTOM_MIN_YUAN && y <= CUSTOM_MAX_YUAN) {
      setAmountMinor(y * 100);
    }
  }, []);

  const onPaidClick = useCallback(async () => {
    setMsg(null);
    if (customInvalid) {
      setMsg(`请输入 ${CUSTOM_MIN_YUAN}～${CUSTOM_MAX_YUAN} 之间的整数金额（元）`);
      return;
    }
    if (!isAllowedMockTopupAmountMinor(amountMinor)) {
      setMsg(`金额须为快捷档位，或 ${CUSTOM_MIN_YUAN}～${CUSTOM_MAX_YUAN} 元整数`);
      return;
    }
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
  }, [amountMinor, customInvalid]);

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
            {PRESETS.map((minor) => (
              <Button
                key={minor}
                type="button"
                variant={amountMinor === minor ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setAmountMinor(minor);
                  setCustomYuan("");
                }}
              >
                ¥{minor / 100}
              </Button>
            ))}
          </div>

          <div className="w-full space-y-2 max-w-sm">
            <label htmlFor="mock-topup-custom-yuan" className="text-sm font-medium">
              自定金额（元）
            </label>
            <Input
              id="mock-topup-custom-yuan"
              type="number"
              inputMode="numeric"
              min={CUSTOM_MIN_YUAN}
              max={CUSTOM_MAX_YUAN}
              step={1}
              placeholder={`${CUSTOM_MIN_YUAN}～${CUSTOM_MAX_YUAN} 整数`}
              value={customYuan}
              onChange={(e) => applyCustomYuan(e.target.value)}
            />
            <p className="text-xs text-muted-foreground leading-relaxed">
              与快捷档位互斥显示：点击档位会清空此处；在此输入有效整数后，下方到账金额会同步（{CUSTOM_MIN_YUAN}～
              {CUSTOM_MAX_YUAN} 元）。
            </p>
            {customInvalid ? (
              <p className="text-xs text-destructive">
                请输入 {CUSTOM_MIN_YUAN}～{CUSTOM_MAX_YUAN} 之间的整数（元）。
              </p>
            ) : null}
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
              disabled={busy || customInvalid}
              onClick={() => void onPaidClick()}
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
