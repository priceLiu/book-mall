"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";

import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import {
  AnimatedAuthFields,
  AuthSubmitButton,
  BoxReveal,
} from "@/components/auth/animated-auth-ui";
import { maskPhone } from "@/lib/auth/phone";

export function LegacyEmailBindPhoneForm() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [donePhone, setDonePhone] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/legacy-email-bind-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        phoneMasked?: string;
        phone?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "绑定失败");
        return;
      }
      setDonePhone(data.phoneMasked ?? (data.phone ? maskPhone(data.phone) : maskPhone(phone)));
    } finally {
      setLoading(false);
    }
  }

  if (donePhone) {
    return (
      <AuthAnimatedScreen brandingText="智选 AI MALL">
        <section className="mx-auto flex w-full max-w-md flex-col gap-4">
          <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
            <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
              绑定成功
            </h2>
          </BoxReveal>
          <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} className="pb-2">
            <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
              手机号 {donePhone} 已绑定到您的邮箱账号。请退出当前登录（如有）后，使用{" "}
              <strong>手机号</strong>重新登录。
            </p>
          </BoxReveal>
          <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
            <Link
              href="/login?switch=1"
              className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              前往登录
            </Link>
          </BoxReveal>
        </section>
      </AuthAnimatedScreen>
    );
  }

  return (
    <AuthAnimatedScreen brandingText="智选 AI MALL">
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
            邮箱账号绑定手机号
          </h2>
        </BoxReveal>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3} className="pb-2">
          <p className="max-w-sm text-sm text-neutral-600 dark:text-neutral-300">
            请输入您以前注册时使用的邮箱，并填写要绑定的手机号。绑定成功后请使用手机号登录。
          </p>
        </BoxReveal>

        <form onSubmit={onSubmit} className="space-y-4">
          <AnimatedAuthFields
            fields={[
              {
                name: "email",
                label: "邮箱",
                type: "email",
                placeholder: "you@example.com",
                value: email,
                onChange: (e) => setEmail(e.target.value),
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

          {error ? (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          ) : null}

          <AuthSubmitButton disabled={loading} loading={loading}>
            绑定
          </AuthSubmitButton>
        </form>

        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <p className="text-center text-sm text-neutral-600 dark:text-neutral-300">
            <Link
              href="/login"
              className="font-medium text-blue-600 outline-none hover:underline dark:text-blue-400"
            >
              返回登录
            </Link>
          </p>
        </BoxReveal>
      </section>
    </AuthAnimatedScreen>
  );
}
