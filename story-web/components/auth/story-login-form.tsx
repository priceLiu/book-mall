"use client";

import { type FormEvent, useCallback, useState } from "react";
import { Clapperboard } from "lucide-react";

type Tab = "password" | "otp";

function buildPortalSigninHref(
  bookOrigin: string,
  token: string,
  phone: string,
  redirect: string,
): string {
  const q = new URLSearchParams({
    t: token,
    phone,
    app: "story",
    redirect,
  });
  return `${bookOrigin.replace(/\/$/, "")}/portal-signin?${q.toString()}`;
}

export function StoryLoginForm({
  bookOrigin,
  redirect,
}: {
  bookOrigin: string | null;
  redirect: string;
}) {
  const [tab, setTab] = useState<Tab>("password");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const sendCode = useCallback(async () => {
    setError(null);
    if (!/^\d{11}$/.test(phone.trim())) {
      setError("请输入 11 位手机号");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), purpose: "LOGIN" }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mockCode?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "发送失败");
        return;
      }
      if (data.mockCode) {
        setCode(data.mockCode);
        setHint(`开发环境验证码：${data.mockCode}`);
      } else {
        setHint("验证码已发送");
      }
    } finally {
      setSending(false);
    }
  }, [phone]);

  const onSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!bookOrigin) {
        setError("门户未配置主站地址，请联系管理员。");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone.trim(),
            loginMode: tab,
            password: tab === "password" ? password : undefined,
            code: tab === "otp" ? code.trim() : undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          autoLoginToken?: string;
        };
        if (!res.ok || !data.autoLoginToken) {
          setError(data.error ?? "登录失败");
          return;
        }
        window.location.href = buildPortalSigninHref(
          bookOrigin,
          data.autoLoginToken,
          phone.trim(),
          redirect,
        );
      } catch {
        setError("无法连接登录服务，请稍后重试。");
      } finally {
        setLoading(false);
      }
    },
    [bookOrigin, phone, password, code, tab, redirect],
  );

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6">
      <div className="flex items-center gap-2 text-white">
        <span className="flex size-9 items-center justify-center rounded-md border border-white/15 bg-white/5">
          <Clapperboard className="size-4 text-white" strokeWidth={2} />
        </span>
        <span className="story-serif text-xl">story-web</span>
      </div>
      <div>
        <h1 className="story-serif text-3xl text-white">欢迎回来</h1>
        <p className="twenty-body mt-2">登录漫剧创作空间，继续你的故事</p>
      </div>

      <div className="flex gap-1 rounded-full border border-white/10 bg-white/5 p-1">
        {(
          [
            ["password", "密码登录"],
            ["otp", "验证码登录"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
              tab === key
                ? "bg-white/10 text-white ring-1 ring-white/15"
                : "text-[var(--story-muted)] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          className="story-input"
          type="tel"
          inputMode="numeric"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="username"
        />
        {tab === "password" ? (
          <input
            className="story-input"
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        ) : (
          <div className="flex gap-2">
            <input
              className="story-input flex-1"
              type="text"
              inputMode="numeric"
              placeholder="短信验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="button"
              className="twenty-btn-ghost whitespace-nowrap"
              onClick={() => void sendCode()}
              disabled={sending}
            >
              {sending ? "发送中…" : "获取验证码"}
            </button>
          </div>
        )}

        {hint ? <p className="text-xs text-[var(--story-muted)]">{hint}</p> : null}
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="twenty-btn w-full" disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--story-muted)]">
        还没有账号？{" "}
        <a
          href={`/register?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-[var(--story-accent)] hover:underline"
        >
          注册
        </a>
      </p>
    </div>
  );
}
