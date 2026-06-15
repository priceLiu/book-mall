"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { maskPhone } from "@/lib/auth/phone";

export function AdminUserBindPhoneButton({
  userId,
  email,
  phone,
  phoneVerified,
}: {
  userId: string;
  email: string | null;
  phone: string | null;
  phoneVerified: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState(phone ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const label = email ?? phone ?? userId.slice(0, 8);

  async function submit() {
    const trimmed = input.trim();
    if (!trimmed) {
      setError("请输入手机号");
      return;
    }

    const action = phoneVerified ? "更换" : "补录";
    if (
      !window.confirm(
        `确认为用户「${label}」${action}手机号 ${trimmed}？\n\n将直接标记为已验证，用户今后可用该手机号登录。`,
      )
    ) {
      return;
    }

    setOpen(true);
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/users/${encodeURIComponent(userId)}/bind-phone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: trimmed }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        phoneMasked?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "操作失败");
        return;
      }
      setSuccess(
        typeof data.phoneMasked === "string"
          ? `已绑定 ${data.phoneMasked}`
          : "绑定成功",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => {
            setOpen(true);
            setError(null);
            setSuccess(null);
            setInput(phone ?? "");
          }}
        >
          {phoneVerified ? "改手机号" : "补录手机"}
        </Button>
      </div>
      {open ? (
        <div className="rounded-md border border-secondary bg-muted/30 p-2 text-xs space-y-2 max-w-[min(100%,14rem)]">
          {phoneVerified && phone ? (
            <p className="text-muted-foreground">
              当前：{maskPhone(phone)}
            </p>
          ) : null}
          <input
            type="tel"
            inputMode="numeric"
            autoComplete="off"
            placeholder="11 位手机号"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded border border-input bg-background px-2 py-1.5 font-mono text-xs"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 text-xs w-full"
            disabled={loading}
            onClick={() => void submit()}
          >
            {loading ? "…" : phoneVerified ? "确认更换" : "确认补录"}
          </Button>
          {error ? <p className="text-destructive">{error}</p> : null}
          {success ? (
            <p className="text-emerald-600 dark:text-emerald-400">{success}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
