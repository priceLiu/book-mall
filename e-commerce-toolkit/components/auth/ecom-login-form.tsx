"use client";

import { type FormEvent, useCallback, useState } from "react";
import { EcomButtonPrimary, EcomButtonSecondary } from "@/components/ui/ecom-button";

const INPUT_CLASS =
  "w-full rounded-xl border border-[#e8e8ed] bg-white px-3.5 py-2.5 text-sm text-[#1d1d1f] outline-none transition focus:border-[var(--ecom-primary)]";

function buildPortalSigninHref(
  bookOrigin: string,
  token: string,
  phone: string,
  redirect: string,
): string {
  const q = new URLSearchParams({ t: token, phone, app: "e-commerce", redirect });
  return `${bookOrigin.replace(/\/$/, "")}/portal-signin?${q.toString()}`;
}

export function EcomLoginForm({
  bookOrigin,
  redirect,
}: {
  bookOrigin: string | null;
  redirect: string;
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
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-[#1d1d1f]">登录电商工具箱</h1>
        <p className="mt-1 text-sm text-[#6e6e73]">主图 · 详情 · 带货视频 · 品牌 VI</p>
      </div>

      <div className="flex gap-1 rounded-full bg-[#f5f5f7] p-1">
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
              tab === key ? "bg-white text-[#1d1d1f] shadow-sm" : "text-[#6e6e73]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input
          className={INPUT_CLASS}
          type="tel"
          inputMode="numeric"
          placeholder="手机号"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="username"
        />
        {tab === "password" ? (
          <input
            className={INPUT_CLASS}
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        ) : (
          <div className="flex items-center gap-2">
            <input
              className={INPUT_CLASS}
              type="text"
              inputMode="numeric"
              placeholder="短信验证码"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <EcomButtonSecondary
              size="sm"
              onClick={() => void sendCode()}
              disabled={sending}
            >
              {sending ? "发送中…" : "获取验证码"}
            </EcomButtonSecondary>
          </div>
        )}

        {hint ? <p className="text-xs text-[#6e6e73]">{hint}</p> : null}
        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}

        <EcomButtonPrimary type="submit" fullWidth disabled={loading}>
          {loading ? "登录中…" : "登录"}
        </EcomButtonPrimary>
      </form>

      <p className="text-center text-sm text-[#6e6e73]">
        还没有账号？{" "}
        <a
          href={`/register?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-[var(--ecom-primary)] hover:underline"
        >
          注册
        </a>
      </p>
    </div>
  );
}
