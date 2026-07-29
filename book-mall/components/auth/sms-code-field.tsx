"use client";

import { useCallback, useState, useRef } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MathCaptcha } from "@/components/auth/math-captcha";

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
  const [showCaptcha, setShowCaptcha] = useState(false);
  const captchaRef = useRef<{ token: string; answer: number } | null>(null);

  const send = useCallback(async () => {
    setError(null);
    setHint(null);

    // 需要先过 captcha
    if (!captchaRef.current) {
      setShowCaptcha(true);
      return;
    }

    setSending(true);
    setShowCaptcha(false);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          purpose,
          captchaToken: captchaRef.current.token,
          captchaAnswer: captchaRef.current.answer,
          ...(inviteToken ? { inviteToken } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string; mockCode?: string };
      if (!res.ok) {
        setError(data.error ?? "发送失败");
        captchaRef.current = null;
        return;
      }
      // 发送成功，captcha 一次性消耗
      captchaRef.current = null;
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
      captchaRef.current = null;
    } finally {
      setSending(false);
    }
  }, [phone, purpose, inviteToken]);

  function handleCaptchaVerify(token: string, answer: number): boolean {
    captchaRef.current = { token, answer };
    // 验证通过后自动触发发送
    setTimeout(() => send(), 0);
    return true;
  }

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

      {showCaptcha && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground mb-2">请先完成验证</p>
          <MathCaptcha onVerify={handleCaptchaVerify} disabled={sending} />
        </div>
      )}

      {hint ? <p className="text-xs text-emerald-600">{hint}</p> : null}
      {error ? (
        <p className="text-xs text-red-500" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
