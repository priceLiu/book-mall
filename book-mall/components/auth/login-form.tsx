"use client";

import { type FormEvent, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthSubmitButton,
  BoxReveal,
} from "@/components/auth/animated-auth-ui";
import { SmsCodeField } from "@/components/auth/sms-code-field";
import { LoginLegacyGuide } from "@/components/auth/login-legacy-guide";
import { markBookMallSessionActive } from "@/lib/session-kicked-marker";
import { cn } from "@/lib/utils";

function safeNextPath(raw: string | null): string {
  if (!raw) return "/account";
  const u = raw.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  try {
    const parsed = new URL(u);
    if (parsed.pathname.startsWith("/")) {
      return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    /* ignore */
  }
  return "/account";
}

function redirectProductionHttpToHttps(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "production") return;
  const { protocol, hostname, href } = window.location;
  if (protocol !== "http:") return;
  const h = hostname.toLowerCase();
  if (h !== "ai-code8.com" && !h.endsWith(".ai-code8.com")) return;
  window.location.replace(href.replace(/^http:/i, "https:"));
}

type LoginTab = "password" | "otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = safeNextPath(searchParams.get("callbackUrl"));

  const [tab, setTab] = useState<LoginTab>("password");
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    redirectProductionHttpToHttps();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn("credentials", {
        phone,
        loginMode: tab,
        password: tab === "password" ? password : undefined,
        code: tab === "otp" ? code : undefined,
        redirect: false,
      });
      if (res?.error) {
        setError(tab === "password" ? "手机号或密码错误" : "手机号或验证码错误");
        return;
      }
      if (!res?.ok) {
        setError("登录请求失败，请清除本站 Cookie 后重试或稍后再试");
        return;
      }
      markBookMallSessionActive();
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
            使用手机号登录智选 AI Mall
          </p>
        </BoxReveal>

        <div className="flex gap-2 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {(
            [
              ["password", "密码登录"],
              ["otp", "验证码登录"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                "flex-1 rounded-md py-2 text-sm font-medium transition-colors",
                tab === key
                  ? "bg-white text-neutral-900 shadow dark:bg-neutral-900 dark:text-neutral-100"
                  : "text-neutral-600 dark:text-neutral-400",
              )}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <AnimatedAuthFields
            fields={[
              {
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: phone,
                onChange: (e) => setPhone(e.target.value),
              },
              ...(tab === "password"
                ? [
                    {
                      name: "password",
                      label: "密码",
                      type: "password" as const,
                      placeholder: "请输入密码",
                      value: password,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value),
                    },
                  ]
                : []),
            ]}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />

          {tab === "otp" ? (
            <SmsCodeField
              phone={phone}
              purpose="LOGIN"
              code={code}
              onCodeChange={setCode}
              disabled={loading}
            />
          ) : null}

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

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

        <LoginLegacyGuide />

        {process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_ALLOW_DEV_AUTH === "1" ? (
          <p className="text-center text-xs text-neutral-500">
            <Link href="/dev/auth" className="underline">
              开发测试登录入口
            </Link>
          </p>
        ) : null}
      </section>
    </AuthAnimatedScreen>
  );
}
