"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type CheckoutRow = {
  id: string;
  remarkCode: string;
  status: string;
  amountYuan: number;
  productLabel: string;
  createdAt: string;
  submittedAt: string | null;
  user: { email: string | null; name: string | null; phone?: string | null };
};

function formatCheckoutTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("zh-CN", { hour12: false });
}

function userLabel(user: CheckoutRow["user"]): string {
  return user.name || user.phone || user.email || "—";
}

type LookupResult = CheckoutRow & {
  outTradeNo: string;
  expiresAt: string;
  submittedAt?: string | null;
};

export function AdminPaymentsClient() {
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [pending, setPending] = useState<CheckoutRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadPending = useCallback(async () => {
    const res = await fetch("/api/admin/payments/list");
    const data = (await res.json().catch(() => ({}))) as {
      checkouts?: CheckoutRow[];
      error?: string;
    };
    if (res.ok) setPending(data.checkouts ?? []);
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  async function onLookup() {
    setErr(null);
    setMsg(null);
    setLookup(null);
    const trimmed = code.replace(/\D/g, "").slice(0, 6);
    if (trimmed.length !== 6) {
      setErr("请输入 6 位数字备注码");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/payments/lookup?code=${trimmed}`);
      const data = (await res.json().catch(() => ({}))) as {
        checkout?: LookupResult;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "未找到");
      setLookup(data.checkout ?? null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "查询失败");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCheckout(id: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${id}/cancel`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "取消失败");
      setMsg("已拒绝/取消该支付单");
      setLookup(null);
      await loadPending();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "取消失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCheckout(id: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/payments/${id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote: "后台备注码核对" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; orderId?: string };
      if (!res.ok) throw new Error(data.error ?? "确认失败");
      setMsg(`已确认到账，订单 ${data.orderId?.slice(0, 8) ?? ""}…`);
      setLookup(null);
      setCode("");
      await loadPending();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "确认失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-semibold">支付核对</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          用户微信转账后会在备注填写 6 位码；在此检索并确认到账。
        </p>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">备注码查询</h2>
        <div className="flex gap-2">
          <Input
            inputMode="numeric"
            maxLength={6}
            placeholder="6 位备注码"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="max-w-[160px] font-mono text-lg tracking-widest"
          />
          <Button type="button" disabled={busy} onClick={() => void onLookup()}>
            查询
          </Button>
        </div>
        {lookup ? (
          <div className="mt-4 rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm space-y-2">
            <p>
              <span className="text-muted-foreground">用户：</span>
              {userLabel(lookup.user)}
            </p>
            <p>
              <span className="text-muted-foreground">下单时间：</span>
              {formatCheckoutTime(lookup.createdAt)}
            </p>
            <p>
              <span className="text-muted-foreground">提交核对：</span>
              {formatCheckoutTime(lookup.submittedAt)}
            </p>
            <p>
              <span className="text-muted-foreground">商品：</span>
              {lookup.productLabel}
            </p>
            <p>
              <span className="text-muted-foreground">金额：</span>¥{lookup.amountYuan.toFixed(2)}
            </p>
            <p>
              <span className="text-muted-foreground">状态：</span>
              {lookup.status === "AWAITING_CONFIRM" ? "待核对" : lookup.status}
            </p>
            <Button
              type="button"
              disabled={busy || lookup.status === "PAID"}
              onClick={() => void confirmCheckout(lookup.id)}
            >
              确认到账
            </Button>
            {lookup.status !== "PAID" && lookup.status !== "CANCELLED" ? (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void cancelCheckout(lookup.id)}
              >
                拒绝/取消
              </Button>
            ) : null}
          </div>
        ) : null}
      </section>

      {err ? <p className="text-sm text-red-600">{err}</p> : null}
      {msg ? <p className="text-sm text-green-600">{msg}</p> : null}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-medium">待核对列表</h2>
        {pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">暂无待核对订单</p>
        ) : (
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2">备注码</th>
                <th className="py-2">用户</th>
                <th className="py-2">商品</th>
                <th className="py-2">金额</th>
                <th className="py-2 whitespace-nowrap">下单时间</th>
                <th className="py-2 whitespace-nowrap">提交核对</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {pending.map((row) => (
                <tr key={row.id} className="border-b border-border/60">
                  <td className="py-2 font-mono">{row.remarkCode}</td>
                  <td className="py-2">{userLabel(row.user)}</td>
                  <td className="py-2">{row.productLabel}</td>
                  <td className="py-2">¥{row.amountYuan.toFixed(2)}</td>
                  <td className="py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatCheckoutTime(row.createdAt)}
                  </td>
                  <td className="py-2 whitespace-nowrap text-xs text-muted-foreground">
                    {formatCheckoutTime(row.submittedAt)}
                  </td>
                  <td className="py-2 text-right space-x-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void confirmCheckout(row.id)}
                    >
                      确认
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => void cancelCheckout(row.id)}
                    >
                      取消
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-medium">代客开通 / 线下已收</h2>
        <CreateForUserForm onDone={() => void loadPending()} />
      </section>
    </div>
  );
}

function CreateForUserForm({ onDone }: { onDone: () => void }) {
  const [targetEmail, setTargetEmail] = useState("");
  const [productKind, setProductKind] = useState("CREDIT_TOPUP");
  const [packId, setPackId] = useState("pack_1000");
  const [planId, setPlanId] = useState("");
  const [scopeKey, setScopeKey] = useState("personal");
  const [adminNote, setAdminNote] = useState("");
  const [confirmImmediately, setConfirmImmediately] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        targetEmail: targetEmail.trim(),
        productKind,
        adminNote: adminNote.trim(),
        confirmImmediately,
      };
      if (productKind === "CREDIT_TOPUP") body.packId = packId.trim();
      if (productKind.startsWith("MEMBERSHIP")) body.planId = planId.trim();
      if (productKind.startsWith("BYOK")) body.scopeKey = scopeKey.trim();
      const res = await fetch("/api/admin/payments/create-for-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        remarkCode?: string;
        orderId?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "创建失败");
      setResult(
        confirmImmediately
          ? `已代客确认到账${data.orderId ? `，订单 ${data.orderId.slice(0, 8)}…` : ""}`
          : `已创建 checkout，备注码 ${data.remarkCode ?? ""}`,
      );
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs text-muted-foreground sm:col-span-2">
        用户邮箱
        <Input
          type="email"
          className="mt-1"
          value={targetEmail}
          onChange={(e) => setTargetEmail(e.target.value)}
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        商品类型
        <select
          className="mt-1 w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          value={productKind}
          onChange={(e) => setProductKind(e.target.value)}
        >
          <option value="CREDIT_TOPUP">轻量包充值</option>
          <option value="MEMBERSHIP_PERSONAL">个人会员</option>
          <option value="MEMBERSHIP_TEAM">团队会员</option>
          <option value="BYOK_PERSONAL">BYOK 个人</option>
          <option value="BYOK_TEAM">BYOK 团队</option>
        </select>
      </label>
      {productKind === "CREDIT_TOPUP" ? (
        <label className="block text-xs text-muted-foreground">
          packId
          <Input className="mt-1 font-mono text-sm" value={packId} onChange={(e) => setPackId(e.target.value)} />
        </label>
      ) : null}
      {productKind.startsWith("MEMBERSHIP") ? (
        <label className="block text-xs text-muted-foreground">
          planId
          <Input className="mt-1 font-mono text-sm" value={planId} onChange={(e) => setPlanId(e.target.value)} />
        </label>
      ) : null}
      {productKind.startsWith("BYOK") ? (
        <label className="block text-xs text-muted-foreground">
          scopeKey
          <Input className="mt-1 font-mono text-sm" value={scopeKey} onChange={(e) => setScopeKey(e.target.value)} />
        </label>
      ) : null}
      <label className="block text-xs text-muted-foreground sm:col-span-2">
        管理员备注（必填）
        <Input className="mt-1" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input
          type="checkbox"
          checked={confirmImmediately}
          onChange={(e) => setConfirmImmediately(e.target.checked)}
        />
        线下已收，直接确认到账
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <Button type="button" disabled={busy} onClick={() => void submit()}>
          提交
        </Button>
        {result ? <span className="text-sm text-green-600">{result}</span> : null}
        {err ? <span className="text-sm text-red-600">{err}</span> : null}
      </div>
    </div>
  );
}
