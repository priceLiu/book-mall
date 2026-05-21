"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthAnimatedScreen,
} from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthOrDivider,
  AuthSubmitButton,
  BoxReveal,
  GoogleAuthButton,
} from "@/components/auth/animated-auth-ui";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/account";
  const u = raw.trim();
  if (!u.startsWith("/") || u.startsWith("//")) return "/account";
  return u;
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("callbackUrl"));

  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const showGoogle = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (res?.error) {
        setError("邮箱或密码错误");
        return;
      }
      if (!res?.ok) {
        setError("登录请求失败，请清除本站 Cookie 后重试或稍后再试");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("无法连接登录服务，请刷新页面后重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthAnimatedScreen brandingText="智选 AI MALL">
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
            欢迎回来
          </h2>
        </BoxReveal>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} className="pb-2">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
            登录以继续使用智选 AI Mall
          </p>
        </BoxReveal>

        {showGoogle ? (
          <>
            <GoogleAuthButton
              label="使用 Google 登录"
              onClick={() => void signIn("google", { callbackUrl: next })}
            />
            <AuthOrDivider />
          </>
        ) : null}

        <form onSubmit={onSubmit}>
          <AnimatedAuthFields
            fields={[
              {
                name: "email",
                label: "邮箱",
                type: "email",
                placeholder: "请输入邮箱",
                value: email,
                onChange: (e) => setEmail(e.target.value),
              },
              {
                name: "password",
                label: "密码",
                type: "password",
                placeholder: "请输入密码",
                value: password,
                onChange: (e) => setPassword(e.target.value),
              },
            ]}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />

          {error ? (
            <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} width="100%">
              <p className="mb-4 text-sm text-red-500" role="alert">
                {error}
              </p>
            </BoxReveal>
          ) : null}

          <div className="mb-4 flex items-center justify-between">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe((v) => !v)}
                className="h-4 w-4 rounded border-neutral-300 dark:border-neutral-600"
              />
              记住我
            </label>
            <span
              className="text-sm text-blue-600 dark:text-blue-400"
              title="请联系客服协助处理账号问题"
            >
              忘记密码？
            </span>
          </div>

          <AuthSubmitButton disabled={loading} loading={loading}>
            登录 &rarr;
          </AuthSubmitButton>
        </form>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-300">
            还没有账号？{" "}
            <Link
              href="/register"
              className="font-medium text-blue-600 outline-none hover:underline dark:text-blue-400"
            >
              注册
            </Link>
          </p>
        </BoxReveal>
      </section>
    </AuthAnimatedScreen>
  );
}
