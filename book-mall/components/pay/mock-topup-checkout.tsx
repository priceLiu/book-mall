"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
import { formatPointsAsYuan } from "@/lib/currency";
import {
  MOCK_TOPUP_CUSTOM_MAX_POINTS,
  MOCK_TOPUP_CUSTOM_MIN_POINTS,
  MOCK_TOPUP_PRESETS,
  isAllowedMockTopupAmountPoints,
} from "@/lib/apply-mock-topup";
import { FakeQrPlaceholder } from "@/components/pay/fake-qr-placeholder";

const PRESETS = MOCK_TOPUP_PRESETS as readonly number[];

const CUSTOM_MIN_YUAN = MOCK_TOPUP_CUSTOM_MIN_POINTS / 100;
const CUSTOM_MAX_YUAN = MOCK_TOPUP_CUSTOM_MAX_POINTS / 100;

export type MockTopupUnusedCoupon = {
  id: string;
  titleSnap: string;
  paidAmountPointsSnap: number;
  bonusPointsSnap: number;
  expiresAt: string;
};

function parseIntegerYuan(raw: string): number | null {
  const t = raw.trim();
  if (t === "" || !/^\d+$/.test(t)) return null;
  const y = Number.parseInt(t, 10);
  return Number.isNaN(y) ? null : y;
}

function initialCustomYuanField(amountPoints: number): string {
  if (PRESETS.includes(amountPoints)) return "";
  if (
    amountPoints >= MOCK_TOPUP_CUSTOM_MIN_POINTS &&
    amountPoints <= MOCK_TOPUP_CUSTOM_MAX_POINTS &&
    amountPoints % 100 === 0
  ) {
    return String(amountPoints / 100);
  }
  return "";
}

export function MockTopupCheckout({
  initialAmountPoints,
  unusedCoupons,
}: {
  initialAmountPoints: number;
  unusedCoupons: MockTopupUnusedCoupon[];
}) {
  const [amountPoints, setAmountPoints] = useState(initialAmountPoints);
  const [customYuan, setCustomYuan] = useState(() => initialCustomYuanField(initialAmountPoints));
  const [selectedCouponId, setSelectedCouponId] = useState<string | null>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const customYuanNum = parseIntegerYuan(customYuan);
  const customInvalid =
    customYuan.trim() !== "" &&
    (customYuanNum === null || customYuanNum < CUSTOM_MIN_YUAN || customYuanNum > CUSTOM_MAX_YUAN);

  const matchingCoupons = useMemo(
    () => unusedCoupons.filter((c) => c.paidAmountPointsSnap === amountPoints),
    [unusedCoupons, amountPoints],
  );

  const selectedBonus =
    selectedCouponId &&
    matchingCoupons.some((c) => c.id === selectedCouponId)
      ? (matchingCoupons.find((c) => c.id === selectedCouponId)?.bonusPointsSnap ?? 0)
      : 0;

  const applyCustomYuan = useCallback((raw: string) => {
    setCustomYuan(raw);
    const y = parseIntegerYuan(raw);
    if (y !== null && y >= CUSTOM_MIN_YUAN && y <= CUSTOM_MAX_YUAN) {
      setAmountPoints(y * 100);
    }
  }, []);

  const onPaidClick = useCallback(async () => {
    setMsg(null);
    if (customInvalid) {
      setMsg(`请输入 ${CUSTOM_MIN_YUAN}～${CUSTOM_MAX_YUAN} 之间的整数金额（元）`);
      return;
    }
    if (!isAllowedMockTopupAmountPoints(amountPoints)) {
      setMsg(`金额须为快捷档位，或 ${CUSTOM_MIN_YUAN}～${CUSTOM_MAX_YUAN} 元整数`);
      return;
    }
    setBusy(true);
    try {
      const body: { amountPoints: number; rechargeCouponId?: string } = {
        amountPoints,
      };
      if (selectedCouponId && matchingCoupons.some((c) => c.id === selectedCouponId)) {
        body.rechargeCouponId = selectedCouponId;
      }
      const res = await fetch("/api/dev/mock-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
  }, [amountPoints, customInvalid, matchingCoupons, selectedCouponId, router]);

  const totalCredit = amountPoints + selectedBonus;

  return (
    <main className="container max-w-lg mx-auto px-4 py-16 md:py-24">
      <Card>
        <CardHeader className="text-center space-y-1">
          <CardTitle>模拟收银（钱包充值）</CardTitle>
          <CardDescription>
            高级能力需「订阅有效 + 余额不低于最低线」。以下为过渡演示：占位二维码 +「支付成功」等同到账。
            充送须先在{" "}
            <Link href="/account/recharge-promos" className="text-primary underline">
              充值优惠
            </Link>{" "}
            领取优惠券，支付时核销。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8 flex flex-col items-center">
          <div className="flex flex-wrap justify-center gap-2 w-full">
            {PRESETS.map((pts) => (
              <Button
                key={pts}
                type="button"
                variant={amountPoints === pts ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setAmountPoints(pts);
                  setCustomYuan("");
                }}
              >
                ¥{pts / 100}
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
            <p className="font-semibold text-lg">实付金额</p>
            <p className="text-3xl font-bold tabular-nums pt-2">
              ¥{formatPointsAsYuan(amountPoints)}
            </p>
            {matchingCoupons.length > 0 ? (
              <div className="pt-4 w-full max-w-md mx-auto text-left space-y-3 border-t border-border/60 mt-4">
                <p className="text-sm font-medium text-center">
                  本档位可用优惠券（{matchingCoupons.length}）
                </p>
                <ul className="space-y-2 text-sm">
                  <li>
                    <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border/80 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <input
                        type="radio"
                        name="rechargeCoupon"
                        className="mt-1"
                        checked={selectedCouponId == null}
                        onChange={() => setSelectedCouponId(null)}
                      />
                      <span className="flex-1 leading-snug">
                        <span className="font-medium">不使用优惠券</span>
                        <span className="block text-muted-foreground text-xs mt-1">
                          仅实付金额到账，已领的券可留待下次（注意券面有效期）。
                        </span>
                      </span>
                    </label>
                  </li>
                  {matchingCoupons.map((c) => (
                    <li key={c.id}>
                      <label className="flex items-start gap-2 cursor-pointer rounded-md border border-border/80 p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                        <input
                          type="radio"
                          name="rechargeCoupon"
                          className="mt-1"
                          checked={selectedCouponId === c.id}
                          onChange={() => setSelectedCouponId(c.id)}
                        />
                        <span className="flex-1 leading-snug">
                          <span className="font-medium">{c.titleSnap}</span>
                          <span className="block text-muted-foreground text-xs mt-1 tabular-nums">
                            另送 {c.bonusPointsSnap.toLocaleString("zh-CN")} 点（¥
                            {formatPointsAsYuan(c.bonusPointsSnap)}）· 有效期至{" "}
                            {new Date(c.expiresAt).toLocaleString("zh-CN")}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted-foreground text-center">
                  有多张券时仅能核销一张；对账以订单关联的券 ID 为准。
                </p>
              </div>
            ) : null}
            <p className="text-sm text-muted-foreground pt-2">
              预计到账合计（含赠送）:{" "}
              <span className="font-semibold text-foreground tabular-nums">
                ¥{formatPointsAsYuan(totalCredit)}
              </span>
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
