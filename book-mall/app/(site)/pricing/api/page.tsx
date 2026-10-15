import { getServerSession } from "next-auth";
import { Suspense } from "react";

import { ApiPricingPageClient } from "@/components/pricing/api-pricing-page-client";
import { authOptions } from "@/lib/auth";
import { listPricingPageModels } from "@/lib/pricing/list-pricing-page-models";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "API 价格 · 充值与模型扣费",
  description:
    "API 会员随用随充；模型扣费与订阅用户统一，充值换算更优惠。",
};

export default async function ApiPricingPage() {
  const session = await getServerSession(authOptions);
  const models = await listPricingPageModels();

  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>}>
      <ApiPricingPageClient
        isLoggedIn={Boolean(session?.user)}
        models={models}
      />
    </Suspense>
  );
}
