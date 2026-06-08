import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadPricingConfig } from "@/lib/pricing/credit-pricing-engine";
import { CreditPricingClient } from "./credit-pricing-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "积分报价计算器 — 管理后台",
};

export default async function CreditPricingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [config, profiles, prices, plans] = await Promise.all([
    loadPricingConfig(),
    prisma.modelCostProfile.findMany({
      where: { active: true },
      orderBy: [{ canonicalModelKey: "asc" }, { channel: "asc" }],
    }),
    prisma.modelCreditPrice.findMany({ orderBy: { canonicalModelKey: "asc" } }),
    prisma.membershipPlan.findMany({
      where: { active: true },
      orderBy: [{ family: "asc" }, { interval: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  // 每个 canonicalModelKey 选优先渠道（CHANNEL→RESELLER→OWN，同档净成本最低）
  const rank: Record<string, number> = { CHANNEL: 0, RESELLER: 1, OWN: 2 };
  const byKey = new Map<string, (typeof profiles)[number]>();
  for (const p of profiles) {
    const cur = byKey.get(p.canonicalModelKey);
    if (
      !cur ||
      (rank[p.channel] ?? 9) < (rank[cur.channel] ?? 9) ||
      ((rank[p.channel] ?? 9) === (rank[cur.channel] ?? 9) &&
        Number(p.netCostYuan) < Number(cur.netCostYuan))
    ) {
      byKey.set(p.canonicalModelKey, p);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">积分报价计算器</h1>
        <p className="text-sm text-muted-foreground">
          左侧实时计算「挂牌价 / 积分次 / 各档生成次数 / 各档毛利」，确认后「发布」写入对外报价。
          公式公开透明：<code>C=成本×(1−折扣) · P=C×M · U=round(P÷锚定) · g=1−C÷(U×售价)</code>。
        </p>
      </header>

      <CreditPricingClient
        config={config}
        models={[...byKey.values()].map((p) => ({
          canonicalModelKey: p.canonicalModelKey,
          vendor: p.vendor,
          channel: p.channel,
          unit: p.unit,
          tierRaw: p.tierRaw,
          listCostYuan: Number(p.listCostYuan),
          discountRate: Number(p.discountRate),
          netCostYuan: Number(p.netCostYuan),
        }))}
        published={prices.map((p) => ({
          canonicalModelKey: p.canonicalModelKey,
          displayName: p.displayName,
          unit: p.unit,
          creditsPerUnit: p.creditsPerUnit,
          listPriceYuan: Number(p.listPriceYuan),
          baseMarginRate: Number(p.baseMarginRate),
          marginM: Number(p.marginM),
          active: p.active,
          publishedAt: p.publishedAt.toISOString(),
        }))}
        plans={plans.map((p) => ({
          family: p.family,
          interval: p.interval,
          tier: p.tier,
          priceYuan: Number(p.priceYuan),
          monthlyCredits: p.monthlyCredits,
        }))}
      />
    </div>
  );
}
