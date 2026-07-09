import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";
import { getWelcomeGiftConfig } from "@/lib/billing/welcome-gift";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "注册 — AI Mall",
};

export default async function RegisterPage() {
  const welcomeGift = await getWelcomeGiftConfig();
  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      }
    >
      <RegisterForm welcomeGift={welcomeGift} />
    </Suspense>
  );
}
