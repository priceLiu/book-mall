"use client";

import { type FormEvent, useCallback, useState } from "react";
import { Sparkles } from "lucide-react";

const INPUT_CLASS =
  "w-full rounded-lg border border-[var(--canvas-border)] bg-[var(--canvas-surface)] px-3 py-2 text-sm text-white outline-none transition focus:border-[var(--canvas-accent)]";

function buildPortalSigninHref(
  bookOrigin: string,
  token: string,
  phone: string,
  redirect: string,
): string {
  const q = new URLSearchParams({ t: token, phone, app: "canvas", redirect });
  return `${bookOrigin.replace(/\/$/, "")}/portal-signin?${q.toString()}`;
}

export function CanvasRegisterForm({
  bookOrigin,
  redirect,
}: {
  bookOrigin: string | null;
  redirect: string;
}) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
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
        body: JSON.stringify({ phone: phone.trim(), purpose: "REGISTER" }),
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
      if (password.length < 8) {
        setError("密码至少 8 位");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: phone.trim(),
            code: code.trim(),
            password,
            name: name.trim() || undefined,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
          autoLoginToken?: string;
        };
        if (!res.ok || !data.autoLoginToken) {
          setError(data.error ?? "注册失败，请稍后重试");
          return;
        }
        window.location.href = buildPortalSigninHref(
          bookOrigin,
          data.autoLoginToken,
          phone.trim(),
          redirect,
        );
      } catch {
        setError("无法连接注册服务，请稍后重试。");
      } finally {
        setLoading(false);
      }
    },
    [bookOrigin, phone, code, password, name, redirect],
  );

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5">
      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-[var(--canvas-accent)]" />
        <span className="text-xl font-semibold text-white">canvas-web</span>
      </div>
      <div>
        <h1 className="text-2xl font-bold text-white">创建账号</h1>
        <p className="mt-1 text-sm text-[var(--canvas-muted)]">
          注册即可开始使用 AI 海报画布
        </p>
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
        <div className="flex gap-2">
          <input
            className={INPUT_CLASS}
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
        <input
          className={INPUT_CLASS}
          type="password"
          placeholder="设置密码（至少 8 位）"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <input
          className={INPUT_CLASS}
          type="text"
          placeholder="昵称（可选）"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {hint ? (
          <p className="text-xs text-[var(--canvas-muted)]">{hint}</p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <button type="submit" className="twenty-btn-accent" disabled={loading}>
          {loading ? "注册中…" : "注册并登录"}
        </button>
      </form>

      <p className="text-center text-sm text-[var(--canvas-muted)]">
        已有账号？{" "}
        <a
          href={`/login?redirect=${encodeURIComponent(redirect)}`}
          className="font-medium text-[var(--canvas-accent)] hover:underline"
        >
          登录
        </a>
      </p>
    </div>
  );
}
