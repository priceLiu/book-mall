"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const reason = searchParams.get("reason");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
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
          使用 Gateway 账号或 Book SSO 登录后管理 API 密钥与厂商凭证。
        </p>
        {reason ? (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            SSO 失败：{reason}
          </p>
        ) : null}
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">邮箱</span>
            <input
              className="gw-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">密码</span>
            <input
              className="gw-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}
          <button type="submit" className="gw-btn w-full" disabled={loading}>
            {loading ? "登录中…" : "登录"}
          </button>
        </form>
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
          {" · "}
          还没有账号？{" "}
          <Link href="/register" className="text-[var(--gw-accent)] hover:underline">
            注册
          </Link>
        </p>
      </div>
    </main>
  );
}
