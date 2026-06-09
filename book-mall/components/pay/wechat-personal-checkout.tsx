"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import { FakeQrPlaceholder } from "@/components/pay/fake-qr-placeholder";
import { Button } from "@/components/ui/button";

export type CheckoutSession = {
  id: string;
  remarkCode: string;
  amountYuan: number;
  status: string;
  productLabel: string;
  expiresAt: string;
};

type CreatePayload = Record<string, unknown>;

export function WechatPersonalCheckout({
  createPayload,
  adminInstant,
  successRedirect,
  onSuccessMessage,
}: {
  createPayload: CreatePayload;
  adminInstant: boolean;
  successRedirect: string;
  onSuccessMessage?: string;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<CheckoutSession | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [payeeName, setPayeeName] = useState("");

  const initCheckout = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createPayload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        checkout?: CheckoutSession & { productLabel: string };
        wechat?: { qrUrl: string | null; payeeName: string };
        adminInstant?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "创建支付单失败");
      if (!data.checkout) throw new Error("创建支付单失败");
      setCheckout({
        id: data.checkout.id,
        remarkCode: data.checkout.remarkCode,
        amountYuan: data.checkout.amountYuan,
        status: data.checkout.status,
        productLabel: data.checkout.productLabel,
        expiresAt: data.checkout.expiresAt,
      });
      setQrUrl(data.wechat?.qrUrl ?? null);
      setPayeeName(data.wechat?.payeeName ?? "");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "创建支付单失败");
    } finally {
      setLoading(false);
    }
  }, [createPayload]);

  useEffect(() => {
    void initCheckout();
  }, [initCheckout]);

  async function onUserSubmitted() {
    if (!checkout) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/payments/checkout/${checkout.id}/submit-paid`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "提交失败");
      setCheckout((c) => (c ? { ...c, status: "AWAITING_CONFIRM" } : c));
      setMsg(onSuccessMessage ?? "已提交，请等待管理员核对到账（备注码勿删）");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy(false);
    }
  }

  async function onAdminInstant() {
    if (!checkout) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/payments/checkout/${checkout.id}/admin-instant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "确认失败");
      window.location.href = successRedirect;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "确认失败");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">正在创建支付单…</p>;
  }

  if (!checkout) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-500">{msg ?? "无法创建支付单"}</p>
        <Button variant="outline" onClick={() => void initCheckout()}>
          重试
        </Button>
      </div>
    );
  }

  const amountLabel = `¥${checkout.amountYuan.toFixed(2)}`;
  const awaiting = checkout.status === "AWAITING_CONFIRM";

  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold">{amountLabel}</p>
      <p className="text-sm text-muted-foreground">{checkout.productLabel}</p>

      {adminInstant ? (
        <FakeQrPlaceholder amountLabel={amountLabel} />
      ) : (
        <div className="flex flex-col items-center gap-3">
          {qrUrl ? (
            <Image
              src={qrUrl}
              alt="微信个人收款码"
              width={220}
              height={220}
              className="rounded-lg border"
              priority
            />
          ) : null}
          {payeeName ? (
            <p className="text-sm text-muted-foreground">收款人：{payeeName}</p>
          ) : null}
          <div className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-center">
            <p className="text-xs text-muted-foreground">转账备注请填写</p>
            <p className="mt-1 font-mono text-3xl font-bold tracking-[0.3em] text-amber-700">
              {checkout.remarkCode}
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            请用微信扫码支付 {amountLabel}，并在备注中填写上方 6 位码
          </p>
        </div>
      )}

      {msg ? (
        <p
          className={`text-sm ${awaiting ? "text-green-600" : "text-red-500"}`}
          role="alert"
        >
          {msg}
        </p>
      ) : null}

      {adminInstant ? (
        <Button className="w-full" disabled={busy} onClick={() => void onAdminInstant()}>
          {busy ? "处理中…" : "管理员确认到账（测试）"}
        </Button>
      ) : awaiting ? (
        <p className="text-center text-sm text-muted-foreground">
          已提交核对，管理员确认后将自动到账
        </p>
      ) : (
        <Button className="w-full" disabled={busy} onClick={() => void onUserSubmitted()}>
          {busy ? "提交中…" : "我已完成支付"}
        </Button>
      )}
    </div>
  );
}
