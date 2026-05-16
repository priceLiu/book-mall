import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { ChevronRight, FileUp, Upload } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildSourceLineLookup,
  classifyBillableRow,
  formulaTextFor,
  unitLabelFor,
  type SourceLineRef,
} from "@/lib/finance/billable-row-classifier";
import {
  CloudPricingMasterClient,
  vendorOfModelKey,
  type MasterRow,
} from "./cloud-pricing-master-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "云厂商价目表 — 管理后台",
};

const PAGE_SIZE = 30;

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function qp(sp: Props["searchParams"], key: string): string {
  const v = sp?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
}

export default async function CloudPricingIndexPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    redirect("/admin");
  }

  const kindFilter = qp(searchParams, "kind");
  const page = Math.max(1, parseInt(qp(searchParams, "page") || "1", 10) || 1);

  const versionWhere = kindFilter ? { kind: kindFilter } : {};
  /** 同时拉当前生效价目版本的 PricingSourceLine，给 classifier 做 modelKey 反查兜底。 */
  const currentVersion = await prisma.pricingSourceVersion.findFirst({
    where: { isCurrent: true },
    select: { id: true },
  });
  const [billables, sourceLines, total, versions, kinds] = await Promise.all([
    prisma.toolBillablePrice.findMany({
      where: { active: true },
      orderBy: [{ toolKey: "asc" }, { schemeARefModelKey: "asc" }, { action: "asc" }],
      select: {
        id: true,
        toolKey: true,
        action: true,
        schemeARefModelKey: true,
        cloudModelKey: true,
        cloudTierRaw: true,
        cloudBillingKind: true,
        schemeAUnitCostYuan: true,
        schemeAAdminRetailMultiplier: true,
        pricePoints: true,
      },
    }),
    currentVersion
      ? prisma.pricingSourceLine.findMany({
          where: { versionId: currentVersion.id },
          select: { modelKey: true, tierRaw: true, billingKind: true },
        })
      : Promise.resolve([] as SourceLineRef[]),
    prisma.pricingSourceVersion.count({ where: versionWhere }),
    prisma.pricingSourceVersion.findMany({
      where: versionWhere,
      orderBy: { importedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        kind: true,
        sourceSha256: true,
        label: true,
        importedAt: true,
        isCurrent: true,
        rowCount: true,
      },
    }),
    prisma.pricingSourceVersion.groupBy({
      by: ["kind"],
      _count: { _all: true },
      _max: { importedAt: true },
      orderBy: { kind: "asc" },
    }),
  ]);
  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const lookup = buildSourceLineLookup(sourceLines as SourceLineRef[]);

  const masterRows: MasterRow[] = billables.map((r) => {
    const modelKey = r.schemeARefModelKey ?? r.cloudModelKey ?? null;
    const cls = classifyBillableRow(r, lookup);
    return {
      id: r.id,
      toolKey: r.toolKey,
      toolLabel: toolKeyToLabel(r.toolKey),
      action: r.action,
      modelKey,
      cloudVendor: vendorOfModelKey(modelKey),
      costYuan: r.schemeAUnitCostYuan,
      multiplier: r.schemeAAdminRetailMultiplier,
      pricePoints: r.pricePoints,
      billingKind: cls.billingKind,
      unitLabel: unitLabelFor(cls.billingKind, cls.tierRaw),
      formulaText: formulaTextFor(cls.billingKind),
    };
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            云厂商价目表
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground leading-relaxed">
            上半部「在库价目」是当前对外定价（来自 <code className="text-foreground">ToolBillablePrice</code>，是真正用于扣费的数据）；
            下半部「导入版本」展示由 <code className="text-foreground">price.md</code> / CSV 导入产生的{" "}
            <code className="text-foreground">PricingSourceVersion</code>（含历史快照）。
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild size="sm" variant="default">
            <Link href="/admin/finance/cloud-pricing/upload">
              <Upload className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              导入 / 转换 CSV
            </Link>
          </Button>
        </div>
      </header>

      {/* 1. 在库价目 (master view) */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">在库价目</h2>
          <Badge variant="secondary" className="text-[10px]">
            {masterRows.length} 行
          </Badge>
          <span className="text-xs text-muted-foreground">
            云厂商 · 工具 · 模型 · 成本价 · 系数 · 对外单价 · 计价标准 · 计价单位 · 公式
          </span>
        </div>
        <CloudPricingMasterClient rows={masterRows} />
      </section>

      {/* 2. 导入版本（次级） */}
      <section className="space-y-3 pt-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="text-base font-semibold tracking-tight text-foreground">导入版本</h2>
          <Badge variant="secondary" className="text-[10px]">
            {total} 版本
          </Badge>
          <span className="text-xs text-muted-foreground">
            每次价目导入（解析 <code className="text-foreground">price.md</code> 或上传 CSV）会产生一个版本；
            <code className="text-foreground">isCurrent=true</code> 即当前生效。
          </span>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">按厂商 / 源类型筛选</CardTitle>
            <CardDescription className="text-xs">
              点击 chip 仅筛该来源的版本列表。当前筛选会保留分页。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              <KindChip label="全部" href="/admin/finance/cloud-pricing" active={!kindFilter} />
              {kinds.map((k) => (
                <KindChip
                  key={k.kind}
                  label={`${k.kind} (${k._count._all})`}
                  href={`/admin/finance/cloud-pricing?kind=${encodeURIComponent(k.kind)}`}
                  active={kindFilter === k.kind}
                  hint={
                    k._max.importedAt
                      ? `最近 ${k._max.importedAt.toISOString().slice(0, 10)}`
                      : undefined
                  }
                />
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground">
                    <th className="border-b border-border bg-muted/40 px-3 py-2 text-left font-medium">
                      版本 ID
                    </th>
                    <th className="border-b border-border bg-muted/40 px-3 py-2 text-left font-medium">
                      厂商 / 源
                    </th>
                    <th className="border-b border-border bg-muted/40 px-3 py-2 text-left font-medium">
                      标签
                    </th>
                    <th className="border-b border-border bg-muted/40 px-3 py-2 text-right font-medium">
                      行数
                    </th>
                    <th className="border-b border-border bg-muted/40 px-3 py-2 text-left font-medium">
                      导入时间
                    </th>
                    <th className="border-b border-border bg-muted/40 px-3 py-2 text-center font-medium">
                      状态
                    </th>
                    <th className="border-b border-border bg-muted/40 px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className="transition-colors hover:bg-muted/30">
                      <td className="border-b border-border/60 px-3 py-2">
                        <code className="text-xs text-muted-foreground">
                          {v.id.slice(0, 12)}…
                        </code>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {v.kind}
                        </Badge>
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-sm text-foreground">
                        {v.label ?? <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right tabular-nums">
                        {v.rowCount}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-xs text-muted-foreground tabular-nums">
                        {v.importedAt.toISOString().replace("T", " ").slice(0, 19)}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-center">
                        {v.isCurrent ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400 border-emerald-500/30">
                            生效中
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">历史</span>
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-2 text-right">
                        <Link
                          href={`/admin/finance/cloud-pricing/${v.id}`}
                          className="inline-flex items-center gap-0.5 text-sm text-primary hover:underline"
                        >
                          查看明细
                          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {versions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                        <FileUp className="mx-auto mb-2 h-6 w-6 opacity-60" aria-hidden />
                        暂无价目版本。请通过{" "}
                        <Link
                          href="/admin/finance/cloud-pricing/upload"
                          className="text-primary hover:underline"
                        >
                          上传 / 转换工具
                        </Link>{" "}
                        导入，或在 book-mall 项目执行{" "}
                        <code className="text-foreground">pnpm pricing:import-markdown</code>。
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {totalPages > 1 ? (
          <nav className="flex flex-wrap items-center gap-1.5 text-sm">
            {Array.from({ length: totalPages }).map((_, i) => {
              const p = i + 1;
              const href = kindFilter
                ? `/admin/finance/cloud-pricing?kind=${encodeURIComponent(kindFilter)}&page=${p}`
                : `/admin/finance/cloud-pricing?page=${p}`;
              return (
                <Link
                  key={p}
                  href={href}
                  className={`rounded border px-2.5 py-1 transition-colors ${
                    p === page
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:bg-muted"
                  }`}
                >
                  {p}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

function KindChip({
  label,
  href,
  active,
  hint,
}: {
  label: string;
  href: string;
  active: boolean;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      title={hint ?? undefined}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}
