import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ModelCostClient } from "./model-cost-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "模型成本与渠道折扣 — 管理后台",
};

export default async function ModelCostPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [profiles, catalogs] = await Promise.all([
    prisma.modelCostProfile.findMany({
      orderBy: [{ canonicalModelKey: "asc" }, { channel: "asc" }],
    }),
    prisma.modelCatalog
      .findMany({ select: { canonicalKey: true, displayName: true }, orderBy: { canonicalKey: "asc" } })
      .catch(() => [] as { canonicalKey: string; displayName: string }[]),
  ]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">模型成本与渠道折扣</h1>
        <p className="text-sm text-muted-foreground">
          维护各厂商 / 模型 / 渠道的<b>挂牌成本与折扣</b>（成本与折扣的唯一来源，仅财务可见）。
          净成本 = 挂牌成本 × (1 − 折扣率)。保存后到「报价计算器」一键发布积分报价。
        </p>
      </header>

      <ModelCostClient
        profiles={profiles.map((p) => ({
          id: p.id,
          vendor: p.vendor,
          canonicalModelKey: p.canonicalModelKey,
          channel: p.channel,
          credentialId: p.credentialId,
          unit: p.unit,
          tierRaw: p.tierRaw,
          listCostYuan: Number(p.listCostYuan),
          discountRate: Number(p.discountRate),
          netCostYuan: Number(p.netCostYuan),
          note: p.note,
          active: p.active,
        }))}
        catalogKeys={catalogs.map((c) => ({ key: c.canonicalKey, name: c.displayName }))}
      />
    </div>
  );
}
