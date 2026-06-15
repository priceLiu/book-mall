"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SmsPurpose = "REGISTER" | "LOGIN" | "BIND_PHONE" | "TEAM_INVITE" | "RESET_PASSWORD";

function normalizeCodeInput(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}

export function SmsCodeField({
  phone,
  purpose,
  code,
  onCodeChange,
  inviteToken,
  disabled,
}: {
  phone: string;
  purpose: SmsPurpose;
  code: string;
  onCodeChange: (v: string) => void;
  inviteToken?: string;
  disabled?: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(async () => {
    setError(null);
    setHint(null);
    setSending(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          purpose,
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; mockCode?: string };
      if (!res.ok) {
        setError(data.error ?? "发送失败");
        return;
      }
      setCooldown(60);
      const timer = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
      if (data.mockCode) {
        setHint(`开发环境验证码：${data.mockCode}`);
      } else {
        setHint("验证码已发送");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSending(false);
    }
  }, [phone, purpose, inviteToken]);

  return (
    <div className="space-y-2">
      <Label htmlFor="sms-code">短信验证码</Label>
      <div className="flex gap-2">
        <Input
          id="sms-code"
          inputMode="text"
          autoComplete="one-time-code"
          maxLength={8}
          placeholder="输入验证码"
          value={code}
          onChange={(e) => onCodeChange(normalizeCodeInput(e.target.value))}
          disabled={disabled}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          disabled={disabled || sending || cooldown > 0 || !phone.trim()}
          onClick={() => void send()}
          className="shrink-0"
        >
          {cooldown > 0 ? `${cooldown}s` : sending ? "发送中…" : "获取验证码"}
        </Button>
      </div>
      {hint ? <p className="text-xs text-emerald-600">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
