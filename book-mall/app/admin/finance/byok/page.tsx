import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ByokConfigClient } from "./byok-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "BYOK 服务费与资源系数 — 管理后台",
};

export default async function ByokConfigPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const [configs, rates] = await Promise.all([
    prisma.byokServiceConfig.findMany({ orderBy: { scopeKey: "asc" } }),
    prisma.resourceMeterRate.findMany({ orderBy: { resourceType: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <header className="space-y-1">
        <h1 className="text-xl font-medium">BYOK 服务费与资源系数</h1>
        <p className="text-sm text-muted-foreground">
          自带 Key（BYOK）只收<b>技术服务费 + 资源使用费</b>，不扣积分、不赚模型差价。
          <code>BYOK 费 = 技术服务费 + Σ(资源用量 × 资源系数)</code>。
        </p>
      </header>

      <ByokConfigClient
        configs={configs.map((c) => ({
          id: c.id,
          scopeKey: c.scopeKey,
          label: c.label,
          techServiceFeeYuan: Number(c.techServiceFeeYuan),
          interval: c.interval,
          note: c.note,
          active: c.active,
        }))}
        rates={rates.map((r) => ({
          resourceType: r.resourceType,
          coefficientYuan: Number(r.coefficientYuan),
          unitLabel: r.unitLabel,
          active: r.active,
        }))}
      />
    </div>
  );
}
