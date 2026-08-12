"use client";

import { type FormEvent, useCallback, useState } from "react";
import Link from "next/link";

const INPUT =
  "w-full rounded-xl border border-[#e8e8ed] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[var(--pub-primary)]";

function buildPortalSigninHref(
  bookOrigin: string,
  token: string,
  phone: string,
  redirect: string,
): string {
  const q = new URLSearchParams({ t: token, phone, app: "publisher", redirect });
  return `${bookOrigin.replace(/\/$/, "")}/portal-signin?${q.toString()}`;
}

export function PublisherLoginForm({
  bookOrigin,
  redirect,
  client,
  loopback,
}: {
  bookOrigin: string | null;
  redirect: string;
  client?: string | null;
  loopback?: string | null;
}) {
  const [tab, setTab] = useState<"password" | "otp">("password");
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
        setError("门户未配置主站地址");
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
        let nextRedirect = redirect;
        if (client === "extension" || client === "desktop") {
          nextRedirect = loopback
            ? `/auth/client-callback?client=${client}&loopback=${encodeURIComponent(loopback)}`
            : `/auth/client-callback?client=${client}`;
        }
        window.location.href = buildPortalSigninHref(
          bookOrigin,
          data.autoLoginToken,
          phone.trim(),
          nextRedirect,
        );
      } finally {
        setLoading(false);
      }
    },
    [bookOrigin, client, code, loopback, password, phone, redirect, tab],
  );

  return (
    <div className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-semibold">登录一键发布</h1>
      <p className="mb-6 text-sm text-[var(--pub-muted)]">
        {client ? "登录成功后将凭证送回客户端" : "使用与全站相同的手机号账号"}
      </p>
      <div className="mb-4 flex gap-2 text-sm">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 ${tab === "password" ? "bg-black/5 font-medium" : ""}`}
          onClick={() => setTab("password")}
        >
          密码
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 ${tab === "otp" ? "bg-black/5 font-medium" : ""}`}
          onClick={() => setTab("otp")}
        >
          验证码
        </button>
      </div>
      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <input
          className={INPUT}
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
        />
        {tab === "password" ? (
          <input
            className={INPUT}
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        ) : (
          <div className="flex gap-2">
            <input
              className={INPUT}
              placeholder="验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              type="button"
              className="shrink-0 rounded-xl border px-3 text-sm"
              disabled={sending}
              onClick={() => void sendCode()}
            >
              {sending ? "发送中" : "获取"}
            </button>
          </div>
        )}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {hint ? <p className="text-sm text-[var(--pub-muted)]">{hint}</p> : null}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[var(--pub-primary)] py-2.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      {!client ? (
        <p className="mt-4 text-center text-sm text-[var(--pub-muted)]">
          没有账号？{" "}
          <Link href="/register" className="text-[var(--pub-primary)]">
            注册
          </Link>
        </p>
      ) : null}
    </div>
  );
}
