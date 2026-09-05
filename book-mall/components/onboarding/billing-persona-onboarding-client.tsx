"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { navigateAfterAuth } from "@/lib/post-auth-navigate";
import { AuthAnimatedScreen } from "@/components/auth/auth-animated-screen";
import { BoxReveal } from "@/components/auth/animated-auth-ui";
import { Button } from "@/components/ui/button";

export function BillingPersonaOnboardingClient() {
  const searchParams = useSearchParams();
  const nextPath = (() => {
    const raw = searchParams.get("next")?.trim();
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
    return raw;
  })();

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/account/billing-persona", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingPersona: "PLATFORM_CREDIT" }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "保存失败");
        return;
      }
      if (nextPath) {
        navigateAfterAuth(nextPath);
        return;
      }
      navigateAfterAuth("/onboarding/welcome?persona=PLATFORM_CREDIT");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthAnimatedScreen variant="register" brandingText="智选 AI MALL">
      <section className="mx-auto flex w-full max-w-md flex-col gap-4">
        <BoxReveal boxColor="hsl(var(--primary))" duration={0.3}>
          <h2 className="text-2xl font-bold">确认计费方式</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            平台代付：购买会员套餐后按积分实时扣费，无需自备云厂商 Key。
          </p>
        </BoxReveal>

        <Button type="button" className="w-full" disabled={loading} onClick={() => onSubmit()}>
          {loading ? "保存中…" : "继续"}
        </Button>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </section>
    </AuthAnimatedScreen>
  );
}
