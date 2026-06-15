"use client";

import { useState } from "react";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";
import type { BillingPersona } from "@prisma/client";
import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import { BoxReveal } from "@/components/auth/animated-auth-ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PERSONA_OPTIONS: {
  value: BillingPersona;
  title: string;
  description: string;
}[] = [
  {
    value: "PLATFORM_CREDIT",
    title: "平台代付",
    description: "购买会员套餐，按积分实时扣费，无需自备云厂商 Key。",
  },
  {
    value: "BYOK",
    title: "自带 Key（BYOK）",
    description: "自备云厂商 Key，开通 BYOK 套餐后绑定 Gateway。",
  },
];

export function BillingPersonaOnboardingClient() {
  const [billingPersona, setBillingPersona] = useState<BillingPersona>("PLATFORM_CREDIT");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/billing-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPersona }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      navigateAfterAuth(`/onboarding/welcome?persona=${billingPersona}`);
      return;
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthAnimatedScreen variant="register" brandingText="智选 AI MALL">
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <h2 className="text-2xl font-bold">选择计费身份</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            选定后不可更改，请根据您的使用方式选择。
          </p>
        </BoxReveal>

        <div className="space-y-2">
          {PERSONA_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                billingPersona === opt.value ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <input
                type="radio"
                checked={billingPersona === opt.value}
                onChange={() => setBillingPersona(opt.value)}
                className="mt-1"
              />
              <span>
                <span className="block text-sm font-medium">{opt.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{opt.description}</span>
              </span>
            </label>
          ))}
        </div>

        {error ? (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        ) : null}

        <Button disabled={loading} className="w-full" onClick={() => void onSubmit()}>
          {loading ? "保存中…" : "确认并继续"}
        </Button>
      </section>
    </AuthAnimatedScreen>
  );
}
