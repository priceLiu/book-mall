import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MembershipPlansClient } from "./membership-plans-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "会员套餐与席位带 — 管理后台",
};

export default async function MembershipPlansPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const plans = await prisma.membershipPlan.findMany({
    orderBy: [{ family: "asc" }, { interval: "asc" }, { sortOrder: "asc" }],
    include: { seatTiers: { orderBy: { sortOrder: "asc" } } },
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">会员套餐与席位带</h1>
        <p className="text-sm text-muted-foreground">
          维护个人 / 团队 × 月 / 年 × 五档套餐与月积分；团队套餐可配置「席位带」（紫色：人数越多每席越便宜）。
          保存后对外报价页即时生效。
        </p>
      </header>

      <MembershipPlansClient
        plans={plans.map((p) => ({
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
          active: p.active,
          seatTiers: p.seatTiers.map((t) => ({
            id: t.id,
            planId: t.planId,
            seatMin: t.seatMin,
            seatMax: t.seatMax,
            perSeatPriceYuan: Number(t.perSeatPriceYuan),
            perSeatCredits: t.perSeatCredits,
            sortOrder: t.sortOrder,
          })),
        }))}
      />
    </div>
  );
}
