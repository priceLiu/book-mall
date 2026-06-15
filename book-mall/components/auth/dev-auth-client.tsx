"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

const PERSONAS = [
  { id: "personal", label: "个人用户", phone: "13800000001" },
  { id: "team_owner", label: "团队 Owner", phone: "13800000002" },
  { id: "team_member", label: "团队成员", phone: "13800000003" },
  { id: "admin", label: "管理员", phone: "13800000009" },
] as const;

export function DevAuthClient() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loginAs(persona: string, phone: string) {
    setLoading(persona);
    setError(null);
    try {
      const ensure = await fetch("/api/dev/auth/ensure-users", { method: "POST" });
      if (!ensure.ok) {
        setError("无法初始化测试账号");
        return;
      }
      const res = await signIn("credentials", {
        phone,
        password: "DevAuth888!",
        loginMode: "password",
        redirect: false,
      });
      if (res?.error) {
        setError("登录失败，请确认 ALLOW_DEV_AUTH 或开发环境");
        return;
      }
      navigateAfterAuth("/account");
      return;
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="mx-auto max-w-lg">
      <CardHeader>
        <CardTitle>开发测试登录</CardTitle>
        <CardDescription>
          免短信一键登录预设账号。Mock 短信号段 13800000001–09，验证码 888888。
          仅 development 或 ALLOW_DEV_AUTH=true 时可用。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {PERSONAS.map((p) => (
          <Button
            key={p.id}
            variant="outline"
            className="w-full justify-start"
            disabled={loading != null}
            onClick={() => void loginAs(p.id, p.phone)}
          >
            {loading === p.id ? "登录中…" : `${p.label}（${p.phone}）`}
          </Button>
        ))}
        {error ? <p className="text-sm text-red-500">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
