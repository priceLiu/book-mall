"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const reason = searchParams.get("reason");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(t);
  }, [cooldown]);

  async function sendCode() {
    setError("");
    setInfo("");
    if (!phone.trim()) {
      setError("请输入手机号");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; mockCode?: string }
        | null;
      if (!res.ok) {
        setError(data?.error ?? "验证码发送失败");
        return;
      }
      setCooldown(60);
      setInfo(
        data?.mockCode ? `测试验证码：${data.mockCode}` : "验证码已发送，请查收短信",
      );
    } finally {
      setSending(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "登录失败");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="gw-card w-full max-w-md">
        <h1 className="text-xl font-semibold text-[var(--gw-ink)]">登录 Gateway</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          使用手机号验证码或 Book SSO 登录后管理 API 密钥与厂商凭证。
        </p>
        {reason ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            SSO 失败：{reason}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">手机号</span>
            <input
              className="gw-input"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              required
              placeholder="请输入手机号"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">验证码</span>
            <div className="flex gap-2">
              <input
                className="gw-input flex-1"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                placeholder="6 位短信验证码"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                type="button"
                className="gw-btn-secondary shrink-0 whitespace-nowrap px-3"
                onClick={() => void sendCode()}
                disabled={sending || cooldown > 0}
              >
                {cooldown > 0 ? `${cooldown}s` : sending ? "发送中…" : "获取验证码"}
              </button>
            </div>
          </label>
          {info ? <p className="text-sm text-emerald-400">{info}</p> : null}
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <button type="submit" className="gw-btn w-full" disabled={loading}>
            {loading ? "登录中…" : "登录 / 注册"}
          </button>
        </form>
        <p className="mt-2 text-center text-xs text-[var(--gw-muted)]">
          新手机号验证码登录将自动创建 Gateway 账号
        </p>
        <div className="mt-4 space-y-3">
          <a
            href={`${process.env.NEXT_PUBLIC_BOOK_MALL_ORIGIN ?? "http://localhost:3000"}/api/sso/gateway/issue?redirect=${encodeURIComponent("/dashboard")}`}
            className="gw-btn-secondary block w-full text-center"
          >
            使用 Book 账号登录
          </a>
        </div>
        <p className="mt-4 text-center text-sm text-[var(--gw-muted)]">
          <Link href="/guide" className="text-[var(--gw-accent)] hover:underline">
            操作指引
          </Link>
        </p>
      </div>
    </main>
  );
}
