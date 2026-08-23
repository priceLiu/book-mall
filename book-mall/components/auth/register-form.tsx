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

export function RegisterForm({
  welcomeGift,
  initialReferralCode,
}: {
  welcomeGift?: { generalCredits: number } | null;
  initialReferralCode?: string;
} = {}) {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [referralCode, setReferralCode] = useState(initialReferralCode?.trim().toUpperCase() ?? "");
  const billingPersona: BillingPersona = "PLATFORM_CREDIT";
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
          ...(referralCode ? { referralCode } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = data as { error?: unknown; detail?: string; hint?: string };
        let msg: string;
        if (typeof err.error === "string") msg = err.error;
        else if (err.error && typeof err.error === "object") msg = JSON.stringify(err.error);
        else msg = "注册失败，请检查表单";
        if (typeof err.hint === "string" && err.hint.length > 0) {
          msg = `${msg}\n${err.hint}`;
        }
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}\n${err.detail}`;
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
            使用手机号注册；订阅会员由平台代付 AI 费用，按积分扣费。
          </p>
        </BoxReveal>

        {welcomeGift && welcomeGift.generalCredits > 0 ? (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
            注册即送 {welcomeGift.generalCredits.toLocaleString()} 积分（30 天内有效）。
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-4">
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
              {
                name: "referralCode",
                label: "邀请码（选填）",
                type: "text",
                placeholder: "8 位邀请码",
                value: referralCode,
                onChange: (e) => setReferralCode(e.target.value.toUpperCase()),
                required: false,
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
            <p className="text-sm text-red-500 whitespace-pre-line" role="alert">
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
