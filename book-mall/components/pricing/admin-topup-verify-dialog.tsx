"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, X } from "lucide-react";

import { SmsCodeField } from "@/components/auth/sms-code-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidCnPhone, normalizePhone } from "@/lib/auth/phone";
import type { CreditTopupPack } from "@/lib/billing/credit-topup-packs";

export function AdminTopupVerifyDialog({
  pack,
  defaultPhone,
  onClose,
}: {
  pack: CreditTopupPack;
  defaultPhone?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [smsReady, setSmsReady] = useState(Boolean(defaultPhone?.trim()));

  const phoneNorm = normalizePhone(phone);
  const phoneValid = Boolean(phoneNorm && isValidCnPhone(phoneNorm));

  async function onConfirmPhone() {
    setError(null);
    if (!phoneValid) {
      setError("请输入正确的 11 位手机号");
      return;
    }
    setSmsReady(true);
  }

  async function onVerifyAndPay() {
    setError(null);
    if (!phoneValid) {
      setError("请输入正确的手机号");
      return;
    }
    if (!code.trim()) {
      setError("请输入短信验证码");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/payments/admin-topup/verify-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packId: pack.id,
          phone: phoneNorm,
          code: code.trim(),
        }),
      });
      const data = (await res.json()) as { error?: string; verifyToken?: string };
      if (!res.ok || !data.verifyToken) {
        setError(data.error ?? "验证失败");
        return;
      }
      const params = new URLSearchParams({
        packId: pack.id,
        verifyToken: data.verifyToken,
      });
      router.push(`/checkout/topup?${params.toString()}`);
      onClose();
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-topup-verify-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="admin-topup-verify-title" className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" />
              购买前验证
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {pack.label} · {pack.credits.toLocaleString()} 视频积分 · ¥{pack.priceYuan.toFixed(2)}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
            aria-label="关闭"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-topup-phone">注册手机号</Label>
            <Input
              id="admin-topup-phone"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="11 位手机号"
              value={phone}
              disabled={smsReady}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
            />
            {!smsReady ? (
              <Button type="button" className="w-full" disabled={!phoneValid} onClick={() => void onConfirmPhone()}>
                下一步：发送验证码
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">验证码将发送至 {phoneNorm}</p>
            )}
          </div>

          {smsReady && phoneNorm ? (
            <SmsCodeField
              phone={phoneNorm}
              purpose="LOGIN"
              code={code}
              onCodeChange={setCode}
            />
          ) : null}

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

          {smsReady ? (
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                取消
              </Button>
              <Button
                type="button"
                className="flex-1"
                disabled={loading || !code.trim()}
                onClick={() => void onVerifyAndPay()}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    验证中…
                  </>
                ) : (
                  "验证并前往支付"
                )}
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
