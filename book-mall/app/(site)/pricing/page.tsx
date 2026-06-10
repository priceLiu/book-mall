import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import {
  BYOK_TASK_KIND_LABEL,
  sortByokQuotasForDisplay,
} from "@/lib/billing/byok-pricing";
import { prisma } from "@/lib/prisma";
import { loadPricingConfig } from "@/lib/pricing/credit-pricing-engine";
import { listUserTenantMemberships } from "@/lib/tenant/context";
import { PricingPageClient } from "@/components/pricing/pricing-page-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = {
  title: "积分报价 · 个人 / 团队会员",
  description:
    "统一积分体系：个人 / 团队，按月 / 年，五档套餐。透明公式：套餐积分 → 各模型每次消耗 → 可生成数量。另支持自带 Key（BYOK），仅收技术服务费与资源费。",
};

export default async function PricingPage() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  const [config, plansRaw, pricesRaw, byok, byokQuotas, rates, teamTenants] = await Promise.all([
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
    prisma.byokServiceConfig.findMany({ where: { active: true }, orderBy: { techServiceFeeYuan: "asc" } }),
    prisma.byokTaskQuota.findMany({ where: { active: true }, orderBy: [{ scopeKey: "asc" }, { taskKind: "asc" }] }),
    prisma.resourceMeterRate.findMany({ where: { active: true }, orderBy: { resourceType: "asc" } }),
    userId
      ? listUserTenantMemberships(userId).then((ms) =>
          ms
            .filter((m) => m.tenantType === "TEAM")
            .map((m) => ({ id: m.tenantId, name: m.tenantName })),
        )
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  return (
    <PricingPageClient
      anchorYuan={config.creditAnchorYuan}
      isLoggedIn={!!userId}
      teamTenants={teamTenants}
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
      byok={byok.map((b) => ({
        scopeKey: b.scopeKey,
        label: b.label,
        techServiceFeeYuan: Number(b.techServiceFeeYuan),
        interval: b.interval,
        minSeats: b.minSeats,
      }))}
      byokQuotas={sortByokQuotasForDisplay(byokQuotas).map((q) => ({
        scopeKey: q.scopeKey,
        taskKind: q.taskKind,
        label: BYOK_TASK_KIND_LABEL[q.taskKind] ?? q.label,
        monthlyIncluded: q.monthlyIncluded,
        overageCredits: q.overageCredits,
      }))}
      rates={rates.map((r) => ({ resourceType: r.resourceType, coefficientYuan: Number(r.coefficientYuan), unitLabel: r.unitLabel }))}
    />
  );
}
