"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/account";
  const u = raw.trim();
  if (!u.startsWith("/") || u.startsWith("//")) return "/account";
  return u;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("邮箱或密码错误");
      return;
    }
    const next = safeNextPath(searchParams.get("callbackUrl"));
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4 px-4 py-16">
      <h1 className="text-2xl font-bold text-center">登录</h1>
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
        <Label htmlFor="password">密码</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
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
        {loading ? "登录中…" : "登录"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        没有账号？{" "}
        <Link href="/register" className="text-primary underline">
          注册
        </Link>
      </p>
    </form>
  );
}
