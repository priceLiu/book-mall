"use client";

import { useCallback, useState, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MathCaptcha } from "@/components/auth/math-captcha";
import { Loader2 } from "lucide-react";

type SmsPurpose = "REGISTER" | "LOGIN" | "BIND_PHONE" | "TEAM_INVITE" | "RESET_PASSWORD";

function normalizeCodeInput(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 8);
}

const COOLDOWN_SECONDS = 60;

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
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = useCallback(() => {
    setCooldown(COOLDOWN_SECONDS);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

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
        // 验证码已消耗，重新出题
        setShowCaptcha(true);
        return;
      }
      // 发送成功，captcha 一次性消耗
      captchaRef.current = null;
      startCooldown();
      if (data.mockCode) {
        setHint(`开发环境验证码：${data.mockCode}`);
      } else {
        setHint("验证码已发送，请注意查收");
      }
    } catch {
      setError("网络错误，请重试");
      captchaRef.current = null;
      setShowCaptcha(true);
    } finally {
      setSending(false);
    }
  }, [phone, purpose, inviteToken, startCooldown]);

  /** MathCaptcha 验证通过后自动调用 */
  function handleCaptchaVerify(token: string, answer: number): boolean {
    captchaRef.current = { token, answer };
    // 验证通过后自动触发发送
    setTimeout(() => send(), 100);
    return true;
  }

  // 倒计时进度百分比（0 → 100%）
  const progress = cooldown > 0 ? (cooldown / COOLDOWN_SECONDS) * 100 : 0;

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
        <div className="relative shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || sending || cooldown > 0 || !phone.trim()}
            onClick={() => void send()}
            className="min-w-[120px]"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                发送中…
              </>
            ) : cooldown > 0 ? (
              <span className="tabular-nums">{cooldown}s 后重发</span>
            ) : (
              "获取验证码"
            )}
          </Button>
          {/* 倒计时进度条 */}
          {cooldown > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden rounded-b-md">
              <div
                className="h-full bg-primary transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {showCaptcha && !sending && cooldown === 0 && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground mb-2">
            请输入下方算式的答案，验证后自动发送短信
          </p>
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
