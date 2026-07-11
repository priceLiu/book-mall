import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getUserBillingPersona } from "@/lib/billing/billing-persona";
import {
  BYOK_TASK_KIND_LABEL,
  sortByokQuotasForDisplay,
} from "@/lib/billing/byok-pricing";
import { prisma } from "@/lib/prisma";
import { loadPricingConfig } from "@/lib/pricing/credit-pricing-engine";
import { getWelcomeGiftConfig } from "@/lib/billing/welcome-gift";
import { listUserTenantMemberships } from "@/lib/tenant/context";
import { PricingPageClient } from "@/components/pricing/pricing-page-client";
import { Suspense } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "积分报价 · 个人 / 团队会员",
  description:
    "统一积分体系：个人 / 团队会员订阅与轻量包充值；透明公式：套餐积分 → 各模型每次消耗。",
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const [config, plansRaw, pricesRaw, byokQuotas, rates, teamTenants, welcomeGift, billingPersona] =
    await Promise.all([
    loadPricingConfig(),
    prisma.membershipPlan.findMany({
      where: { active: true },
      orderBy: [{ family: "asc" }, { interval: "asc" }, { sortOrder: "asc" }],
      include: { seatTiers: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.modelCreditPrice.findMany({
      where: { active: true },
      orderBy: { creditsPerUnit: "asc" },
    }),
    prisma.byokTaskQuota.findMany({ where: { active: true }, orderBy: [{ scopeKey: "asc" }, { taskKind: "asc" }] }),
    prisma.resourceMeterRate.findMany({ where: { active: true }, orderBy: { resourceType: "asc" } }),
    userId
      ? listUserTenantMemberships(userId).then((ms) =>
          ms
            .filter((m) => m.tenantType === "TEAM")
            .map((m) => ({ id: m.tenantId, name: m.tenantName })),
        )
      : Promise.resolve([] as { id: string; name: string }[]),
    getWelcomeGiftConfig(),
    userId ? getUserBillingPersona(userId) : Promise.resolve(null),
  ]);

  return (
    <Suspense fallback={<p className="py-16 text-center text-sm text-muted-foreground">加载中…</p>}>
      <PricingPageClient
        anchorYuan={config.creditAnchorYuan}
        isLoggedIn={!!userId}
        billingPersona={billingPersona}
        plans={plansRaw.map((p) => ({
          id: p.id,
          family: p.family,
          interval: p.interval,
          tier: p.tier,
          sortOrder: p.sortOrder,
          priceYuan: Number(p.priceYuan),
          originalYuan: p.originalYuan == null ? null : Number(p.originalYuan),
          promoLabel: p.promoLabel,
          monthlyCredits: p.monthlyCredits,
          videoMonthlyCredits: p.videoMonthlyCredits,
          includedSeats: p.includedSeats,
          seatTiers: p.seatTiers.map((t) => ({
            seatMin: t.seatMin,
            seatMax: t.seatMax,
            perSeatPriceYuan: Number(t.perSeatPriceYuan),
            perSeatCredits: t.perSeatCredits,
          })),
        }))}
        models={pricesRaw.map((m) => ({
          canonicalModelKey: m.canonicalModelKey,
          displayName: m.displayName,
          unit: m.unit,
          creditsPerUnit: m.creditsPerUnit,
        }))}
        byokQuotas={sortByokQuotasForDisplay(byokQuotas).map((q) => ({
          scopeKey: q.scopeKey,
          taskKind: q.taskKind,
          label: BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label,
          monthlyIncluded: q.monthlyIncluded,
          overageCredits: q.overageCredits,
        }))}
        rates={rates.map((r) => ({
          resourceType: r.resourceType,
          coefficientYuan: Number(r.coefficientYuan),
          unitLabel: r.unitLabel,
        }))}
        teamTenants={teamTenants}
        welcomeGift={welcomeGift}
      />
    </Suspense>
  );
}
