"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface Props {
  checkoutId: string;
  amountYuan: number;
  description: string;
  onPaid?: () => void;
}

export function WechatEnterpriseCheckout({ checkoutId, amountYuan, description, onPaid }: Props) {
  const [codeUrl, setCodeUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 创建支付订单
  useEffect(() => {
    async function create() {
      try {
        const res = await fetch("/api/payments/wechat/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ checkoutId, amountYuan, description }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "创建支付订单失败");
        setCodeUrl(data.codeUrl);

        // 生成二维码图片
        const qr = await QRCode.toDataURL(data.codeUrl, {
          width: 256,
          margin: 2,
          color: { dark: "#000000", light: "#ffffff" },
        });
        setQrDataUrl(qr);
      } catch (e) {
        setError(e instanceof Error ? e.message : "创建支付订单失败");
      } finally {
        setLoading(false);
      }
    }
    create();
  }, [checkoutId, amountYuan, description]);

  // 轮询支付状态
  useEffect(() => {
    if (!codeUrl) return;

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/wechat/query?checkoutId=${checkoutId}`);
        const data = await res.json();
        if (data.paid) {
          setPaid(true);
          if (pollingRef.current) clearInterval(pollingRef.current);
          onPaid?.();
        }
      } catch {
        // 轮询静默失败
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [codeUrl, checkoutId, onPaid]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        <p className="text-sm text-muted-foreground">正在创建支付订单…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <XCircle className="h-8 w-8 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          重试
        </Button>
      </div>
    );
  }

  if (paid) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4">
        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
        <p className="text-lg font-semibold text-emerald-600">支付成功！</p>
        <p className="text-sm text-muted-foreground">订单正在处理中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 py-6">
      <p className="text-sm text-muted-foreground">请使用微信扫描二维码支付</p>

      {qrDataUrl && (
        <img
          src={qrDataUrl}
          alt="微信支付二维码"
          className="rounded-lg border"
          width={256}
          height={256}
        />
      )}

      <p className="text-2xl font-bold">¥{amountYuan.toFixed(2)}</p>
      <p className="text-xs text-muted-foreground">{description}</p>

      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        等待支付中…
      </p>
    </div>
  );
}
