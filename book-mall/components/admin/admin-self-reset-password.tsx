"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function AdminSelfResetPasswordCard() {
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function reset() {
    if (
      !window.confirm(
        "将为您随机生成新登录密码，旧密码立即失效。本页仅此时展示一次新密码，是否继续？",
      )
    ) {
      return;
    }
    setError(null);
    setCopied(false);
    setPassword(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/me/reset-password", { method: "POST" });
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">管理员登录密码</CardTitle>
        <CardDescription>
          一键随机重置当前管理员账号的邮箱密码。成功后请立即复制保存；请勿泄露或重复使用临时密码。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button type="button" variant="destructive" size="sm" onClick={reset} disabled={loading}>
          {loading ? "处理中…" : "一键重置我的密码"}
        </Button>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {password ? (
          <div className="rounded-lg border border-secondary bg-muted/40 p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">新密码（仅此一次展示）</p>
            <code className="block break-all rounded-md bg-background px-3 py-2 text-sm font-mono border border-input">
              {password}
            </code>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const ok = await copyText(password);
                  setCopied(ok);
                  if (!ok) window.alert("复制失败，请手动全选复制。");
                }}
              >
                {copied ? "已复制" : "复制密码"}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
