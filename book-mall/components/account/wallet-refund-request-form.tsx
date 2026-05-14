"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WalletRefundRequestForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const yuan = String(fd.get("amountYuan") ?? "").trim();
    const userNote = String(fd.get("userNote") ?? "").trim();
    let requestedAmountPoints: number | null = null;
    if (yuan) {
      const n = Math.round(parseFloat(yuan) * 100);
      if (!Number.isFinite(n) || n <= 0) {
        setError("提现金额无效");
        setLoading(false);
        return;
      }
      requestedAmountPoints = n;
    }
    try {
      const res = await fetch("/api/account/wallet-refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestedAmountPoints, userNote: userNote || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "提交失败");
        return;
      }
      (e.target as HTMLFormElement).reset();
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 text-sm">
      <div className="space-y-1">
        <Label htmlFor="amountYuan">申请提现金额（元，留空表示按可提现余额由后台核算）</Label>
        <Input id="amountYuan" name="amountYuan" type="number" step={0.01} placeholder="例如 50.00" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="userNote">说明（可选）</Label>
        <Textarea id="userNote" name="userNote" rows={2} maxLength={2000} />
      </div>
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "提交中…" : "提交余额提现申请"}
      </Button>
    </form>
  );
}
