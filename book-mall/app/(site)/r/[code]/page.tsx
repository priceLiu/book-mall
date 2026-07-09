import { Suspense } from "react";

import { ReferralRegisterForm } from "@/components/auth/referral-register-form";
import { resolveReferrerByCode } from "@/lib/referral/referral-service";
import { getWelcomeGiftConfig } from "@/lib/billing/welcome-gift";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "邀请注册 — AI Mall",
};

export default async function ReferralRegisterPage({
  params,
}: {
  params: { code: string };
}) {
  const code = params.code?.trim().toUpperCase() ?? "";
  const [referrer, welcomeGift] = await Promise.all([
    code ? resolveReferrerByCode(code) : Promise.resolve(null),
    getWelcomeGiftConfig(),
  ]);

  return (
    <Suspense
      fallback={
        <p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>
      }
    >
      <ReferralRegisterForm
        code={code}
        referrerName={referrer?.referrerName ?? null}
        welcomeGift={welcomeGift}
      />
    </Suspense>
  );
}
