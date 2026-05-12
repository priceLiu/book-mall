"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AdminUserResetPasswordButton({
  userId,
  email,
}: {
  userId: string;
  email: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function reset() {
    const label = email ?? userId;
    if (
      !window.confirm(
        `确认为用户「${label}」重置登录密码？旧密码将立即失效，新密码仅展示一次。`,
      )
    ) {
      return;
    }
    setOpen(true);
    setError(null);
    setCopied(false);
    setPassword(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-password`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        password?: string;
      };
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "重置失败");
        return;
      }
      if (typeof data.password === "string") setPassword(data.password);
      else setError("响应异常");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={reset}>
        {loading ? "…" : "重置密码"}
      </Button>
      {open && (error || password) ? (
        <div className="rounded-md border border-secondary bg-muted/30 p-2 text-xs space-y-2 max-w-[min(100%,14rem)]">
          {error ? <p className="text-destructive">{error}</p> : null}
          {password ? (
            <>
              <p className="font-medium text-foreground">新密码（仅展示一次）</p>
              <code className="block break-all font-mono bg-background px-2 py-1 rounded border border-input">
                {password}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 text-xs w-full"
                onClick={async () => {
                  const ok = await copyText(password);
                  setCopied(ok);
                  if (!ok) window.alert("复制失败，请手动复制。");
                }}
              >
                {copied ? "已复制" : "复制"}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
