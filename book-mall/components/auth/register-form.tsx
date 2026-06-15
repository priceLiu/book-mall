"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BillingPersona } from "@prisma/client";

import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthSubmitButton,
  BoxReveal,
} from "@/components/auth/animated-auth-ui";
import { SmsCodeField } from "@/components/auth/sms-code-field";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";
import { cn } from "@/lib/utils";

const PERSONA_OPTIONS: {
  value: BillingPersona;
  title: string;
  description: string;
}[] = [
  {
    value: "PLATFORM_CREDIT",
    title: "平台代付（推荐）",
    description: "购买会员套餐，平台代付 AI 费用，按积分实时扣费，无需自备云厂商 Key。",
  },
  {
    value: "BYOK",
    title: "自带 Key（BYOK）",
    description: "自备云厂商 API Key，平台收取技术服务费；云账单在 Gateway 查看。",
  },
];

export function RegisterForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [billingPersona, setBillingPersona] = useState<BillingPersona>("PLATFORM_CREDIT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          password,
          name: name || undefined,
          billingPersona,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: unknown; detail?: string };
        let msg: string;
        if (typeof err.error === "string") msg = err.error;
        else if (err.error && typeof err.error === "object") msg = JSON.stringify(err.error);
        else msg = "注册失败，请检查表单";
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}：${err.detail}`;
        }
        setError(msg);
        return;
      }

      const login = await signIn("credentials", {
        phone,
        password,
        loginMode: "password",
        redirect: false,
      });
      if (login?.error) {
        router.push("/login?registered=1");
        return;
      }
      navigateAfterAuth("/account");
      return;
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
            使用手机号注册；请选择计费方式（注册后不可更改）
          </p>
        </BoxReveal>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            {PERSONA_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition",
                  billingPersona === opt.value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40",
                )}
              >
                <input
                  type="radio"
                  name="billingPersona"
                  value={opt.value}
                  checked={billingPersona === opt.value}
                  onChange={() => setBillingPersona(opt.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{opt.title}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {opt.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

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
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: phone,
                onChange: (e) => setPhone(e.target.value),
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

          <SmsCodeField
            phone={phone}
            purpose="REGISTER"
            code={code}
            onCodeChange={setCode}
            disabled={loading}
          />

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
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
