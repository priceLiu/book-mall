"use client";

import { type FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthSubmitButton,
  BoxReveal,
} from "@/components/auth/animated-auth-ui";
import { SmsCodeField } from "@/components/auth/sms-code-field";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";

export function ReferralRegisterForm({
  code,
  referrerName,
}: {
  code: string;
  referrerName: string | null;
}) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("请填写昵称");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code: smsCode,
          name: name.trim(),
          referralCode: code,
          billingPersona: "PLATFORM_CREDIT",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
        detail?: string;
        autoLoginToken?: string;
      };
      if (!res.ok) {
        const err = data as { error?: unknown; detail?: string };
        let msg: string;
        if (typeof err.error === "string") msg = err.error;
        else if (err.error && typeof err.error === "object")
          msg = JSON.stringify(err.error);
        else msg = "注册失败，请检查表单";
        if (typeof err.detail === "string" && err.detail.length > 0) {
          msg = `${msg}：${err.detail}`;
        }
        setError(msg);
        return;
      }

      // 免密注册：用服务端返回的一次性票据建立会话。
      const login = await signIn("credentials", {
        phone,
        autoLoginToken: data.autoLoginToken,
        loginMode: "autologin",
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
            邀请注册
          </h2>
        </BoxReveal>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} className="pb-2">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
            {referrerName
              ? `${referrerName} 邀请你加入 AI Mall`
              : "你正在通过分享链接注册 AI Mall"}
            ，填写昵称并验证手机号即可完成，无需设置密码（后续可用短信验证码登录）。
          </p>
        </BoxReveal>

        <form onSubmit={onSubmit} className="space-y-4">
          <AnimatedAuthFields
            fields={[
              {
                name: "name",
                label: "昵称",
                type: "text",
                placeholder: "请输入昵称",
                value: name,
                onChange: (e) => setName(e.target.value),
              },
              {
                name: "phone",
                label: "手机号",
                type: "tel",
                placeholder: "请输入 11 位手机号",
                value: phone,
                onChange: (e) => setPhone(e.target.value),
              },
            ]}
          />

          <SmsCodeField
            phone={phone}
            purpose="REGISTER"
            code={smsCode}
            onCodeChange={setSmsCode}
            disabled={loading}
          />

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

          <AuthSubmitButton disabled={loading} loading={loading}>
            完成注册 &rarr;
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
