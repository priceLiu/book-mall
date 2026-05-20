"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthOrDivider,
  AuthSubmitButton,
  BoxReveal,
  GoogleAuthButton,
} from "@/components/auth/animated-auth-ui";

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const showGoogle = process.env.NEXT_PUBLIC_AUTH_GOOGLE === "1";

  async function onSubmit(e: FormEvent) {
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
    <AuthAnimatedScreen variant="register" brandingText="智选 AI MALL">
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
            创建账号
          </h2>
        </BoxReveal>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} className="pb-2">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
            加入智选 AI Mall，开启订阅与工具权益
          </p>
        </BoxReveal>

        {showGoogle ? (
          <>
            <GoogleAuthButton
              label="使用 Google 注册"
              onClick={() => void signIn("google", { callbackUrl: "/account" })}
            />
            <AuthOrDivider />
          </>
        ) : null}

        <form onSubmit={onSubmit}>
          <AnimatedAuthFields
            fields={[
              {
                name: "name",
                label: "昵称",
                type: "text",
                placeholder: "选填",
                value: name,
                onChange: (e) => setName(e.target.value),
                required: false,
              },
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
                placeholder: "至少 8 位",
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

          <AuthSubmitButton disabled={loading} loading={loading}>
            创建账号 &rarr;
          </AuthSubmitButton>
        </form>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <p className="mt-2 text-center text-sm text-neutral-600 dark:text-neutral-300">
            已有账号？{" "}
            <Link
              href="/login"
              className="font-medium text-blue-600 outline-none hover:underline dark:text-blue-400"
            >
              登录
            </Link>
          </p>
        </BoxReveal>
      </section>
    </AuthAnimatedScreen>
  );
}
