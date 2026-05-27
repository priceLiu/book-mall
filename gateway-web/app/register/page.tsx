"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "注册失败");
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
        <h1 className="text-xl font-semibold text-white">注册 Gateway 账号</h1>
        <p className="mt-1 text-sm text-[var(--gw-muted)]">
          独立 Gateway 账号；若已在 Book 注册请使用 Book SSO 登录。
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">昵称（可选）</span>
            <input
              className="gw-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
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
            <span className="mb-1 block text-sm text-[var(--gw-muted)]">密码（至少 8 位）</span>
            <input
              className="gw-input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="text-sm text-red-400">{error}</p>
          ) : null}
          <button type="submit" className="gw-btn w-full" disabled={loading}>
            {loading ? "注册中…" : "注册"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--gw-muted)]">
          已有账号？{" "}
          <Link href="/login" className="text-[var(--gw-accent)] hover:underline">
            登录
          </Link>
        </p>
      </div>
    </main>
  );
}
