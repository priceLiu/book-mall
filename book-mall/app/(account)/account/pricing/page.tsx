import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import {
  buildSourceLineLookup,
  classifyBillableRow,
  unitLabelFor,
  type SourceLineRef,
} from "@/lib/finance/billable-row-classifier";
import { PricingTableClient } from "./pricing-table-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "我方价目表 — 个人中心",
};

export default async function MyPricingTablePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login?next=/account/pricing");
  }

  /** 同时拉现行 PricingSourceLine 作为兜底（部分历史行 cloudBillingKind 可能仍为 NULL）。 */
  const currentVersion = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  const [rows, sourceLines] = await Promise.all([
    prisma.toolBillablePrice.findMany({
      where: { active: true },
      select: {
        id: true,
        toolKey: true,
        action: true,
        schemeARefModelKey: true,
        cloudModelKey: true,
        cloudTierRaw: true,
        cloudBillingKind: true,
        pricePoints: true,
      },
      orderBy: [{ toolKey: "asc" }, { action: "asc" }, { schemeARefModelKey: "asc" }],
    }),
    currentVersion
      ? prisma.pricingSourceLine.findMany({
          where: { versionId: currentVersion.id },
          select: { modelKey: true, tierRaw: true, billingKind: true },
        })
      : Promise.resolve([] as SourceLineRef[]),
  ]);
  const lookup = buildSourceLineLookup(sourceLines as SourceLineRef[]);

  const rowsForClient = rows.map((r) => {
    const cls = classifyBillableRow(r, lookup);
    return {
      id: r.id,
      toolKey: r.toolKey,
      toolLabel: toolKeyToLabel(r.toolKey),
      action: r.action,
      schemeARefModelKey: r.schemeARefModelKey,
      cloudTierRaw: cls.tierRaw,
      cloudBillingKind: cls.billingKind,
      unitLabel: unitLabelFor(cls.billingKind, cls.tierRaw),
      pricePoints: r.pricePoints,
    };
  });

  return (
    <main className="py-8 md:py-10">
      <div className="space-y-6">
        <header className="space-y-1">
          <Link href="/account" className="text-sm text-primary hover:underline">
            ← 返回个人中心
          </Link>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">我方价目表</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            以下是工具站各模型的「按次 / 按图 / 按秒」<strong className="text-foreground">我方零售价</strong>
            （单位：点；100 点 = 1 元）。实际扣费以调用成功后系统记账为准；下列价格不含税。
          </p>
        </header>

        <PricingTableClient rows={rowsForClient} />
      </div>
    </main>
  );
}
