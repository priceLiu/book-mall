"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as {
          error?: unknown;
          detail?: string;
        };
        let msg: string;
        if (typeof err.error === "string") {
          msg = err.error;
        } else if (err.error && typeof err.error === "object") {
          msg = JSON.stringify(err.error);
        } else {
          msg = "注册失败，请检查表单";
        }
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}：${err.detail}`;
        }
        setError(msg);
        return;
      }
      router.push("/login");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4 px-4 py-16">
      <h1 className="text-2xl font-bold text-center">注册</h1>
      <div className="space-y-2">
        <Label htmlFor="name">昵称（可选）</Label>
        <Input
          id="name"
          type="text"
          autoComplete="nickname"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">邮箱</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">密码（至少 8 位）</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "提交中…" : "创建账号"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        已有账号？{" "}
        <Link href="/login" className="text-primary underline">
          登录
        </Link>
      </p>
    </form>
  );
}
