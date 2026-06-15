"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthSubmitButton,
  BoxReveal,
} from "@/components/auth/animated-auth-ui";
import { SmsCodeField } from "@/components/auth/sms-code-field";

export function BindPhoneForm({ needsPassword }: { needsPassword?: boolean }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/bind-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          code,
          ...(needsPassword && password ? { password } : {}),
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "绑定失败");
        return;
      }
      router.push("/account?phoneBound=1");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthAnimatedScreen brandingText="智选 AI MALL">
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
            绑定手机号
          </h2>
        </BoxReveal>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} className="pb-2">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
            平台已切换为手机号登录。请验证您的手机号；绑定成功后请使用手机号登录。
          </p>
        </BoxReveal>

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
              ...(needsPassword
                ? [
                    {
                      name: "password",
                      label: "设置登录密码（可选）",
                      type: "password" as const,
                      placeholder: "至少 8 位，便于密码登录",
                      value: password,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                        setPassword(e.target.value),
                      required: false,
                    },
                  ]
                : []),
            ]}
            passwordVisible={showPassword}
            onTogglePassword={() => setShowPassword((v) => !v)}
          />

          <SmsCodeField
            phone={phone}
            purpose="BIND_PHONE"
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
            完成绑定 &rarr;
          </AuthSubmitButton>
        </form>
      </section>
    </AuthAnimatedScreen>
  );
}
