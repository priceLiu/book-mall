import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminToolBillablePricingClient } from "@/components/admin/admin-tool-billable-pricing";
import { buildRowPayloads, type CloudCostOverlay } from "@/lib/tool-billable-row-payloads";
import { loadSchemeAModelCatalog } from "@/lib/tool-billable-scheme-a-admin-cost";
import { resolveInitialCostMultForBillableRow } from "@/lib/tool-billable-row-initial";
import {
  buildCloudCostLookup,
  makeCloudCostOverlay,
} from "@/lib/tool-billable-cloud-cost-overlay";

export const metadata = {
  title: "工具管理 — 管理后台",
};

export default async function AdminToolAppsManagePage() {
  const [prices, catalog, currentVersion] = await Promise.all([
    prisma.toolBillablePrice.findMany({
      orderBy: [
        { toolKey: "asc" },
        { action: "asc" },
        { schemeARefModelKey: "asc" },
        { effectiveFrom: "desc" },
        { updatedAt: "desc" },
      ],
    }),
    loadSchemeAModelCatalog(),
    prisma.pricingSourceVersion.findFirst({
      where: { isCurrent: true },
      select: { id: true, label: true, importedAt: true },
    }),
  ]);

  const currentLines = currentVersion
    ? await prisma.pricingSourceLine.findMany({
        where: { versionId: currentVersion.id },
      })
    : [];
  const cloudLookup = buildCloudCostLookup(currentLines);

  const initials = await Promise.all(
    prices.map((p) => resolveInitialCostMultForBillableRow(p)),
  );
  const overlays: CloudCostOverlay[] = prices.map((p) =>
    makeCloudCostOverlay({
      cloudModelKey: p.cloudModelKey,
      cloudTierRaw: p.cloudTierRaw,
      cloudBillingKind: p.cloudBillingKind,
      schemeARefModelKey: p.schemeARefModelKey,
      schemeAUnitCostYuan: p.schemeAUnitCostYuan,
      lookup: cloudLookup,
    }),
  );
  const rowPayloads = buildRowPayloads(prices, initials, overlays);
  const optionsByKeyJson = JSON.stringify(catalog.optionsByKey);

  const statusCounts = {
    current: rowPayloads.filter((r) => r.status === "current").length,
    future: rowPayloads.filter((r) => r.status === "future").length,
    expired: rowPayloads.filter((r) => r.status === "expired").length,
    inactive: rowPayloads.filter((r) => r.status === "inactive").length,
  };
  const toolKeyCount = new Set(rowPayloads.map((r) => r.toolKey)).size;
  const driftCount = rowPayloads.filter(
    (r) =>
      r.cloudCostDriftPercent != null &&
      Math.abs(r.cloudCostDriftPercent) >= 0.01,
  ).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">工具管理</h1>
        <p className="text-sm text-muted-foreground">
          前台工具「按次扣费」单价<strong className="text-foreground">仅此页维护</strong>
          （产品管理不再标价），数据与 <code className="text-xs">ToolBillablePrice</code>{" "}
          一致。工具站侧栏入口显隐请至{" "}
          <Link
            href="/admin/tool-apps/tool-menu"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            工具菜单
          </Link>
          配置。
          试衣间实际计费入口为 <strong>AI智能试衣页</strong>（
          <code className="text-xs">fitting-room__ai-fit</code> +{" "}
          <code className="text-xs">try_on</code>）；套装 / 衣柜等路径不产生该项自动单价。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>按次单价</CardTitle>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              本表每行的<strong className="text-foreground">「单价(元)」「成本(元)」「系数 M」</strong>是
              <strong className="text-foreground">该行落库时的快照</strong>，<em>不会自动随云厂商价格更新</em>。
              真正运行时实扣由
              <code className="mx-1 text-xs">resolveBillableSnapshot()</code>
              在每次调用时选「当前生效行」（
              <code className="text-xs">active && effectiveFrom ≤ now && (effectiveTo IS NULL || effectiveTo ≥ now)</code>）。
              下表中带 <span className="text-emerald-600 dark:text-emerald-400">当前生效</span> 徽章的行才是用户实付价。
            </p>
            <p>
              已有行<strong className="text-foreground">仅当生效止为空</strong>时可填<strong className="text-foreground">一次</strong>结束时间；已设结束时间后不可再改。
              调价请用下方<strong className="text-foreground">新增定价</strong>（新 <code className="text-xs">effectiveFrom</code>），必要时给旧行填生效止以闭合区间。
              「云厂商成本（最新）」列基于 <code className="text-xs">PricingSourceVersion isCurrent=true</code> 的
              <code className="text-xs">PricingSourceLine</code>{" "}回链；若与本行成本快照漂移 ≥ 1%，将以琥珀色提示，建议按新成本发布新定价行。
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <Stat label="总行数" value={rowPayloads.length} />
            <Stat label="toolKey 数" value={toolKeyCount} />
            <Stat
              label="当前生效"
              value={statusCounts.current}
              tone="emerald"
            />
            <Stat label="未来 / 过期" value={statusCounts.future + statusCounts.expired} tone="muted" />
            <Stat label="已停用" value={statusCounts.inactive} tone="muted" />
            <Stat
              label="云厂商漂移 ≥1%"
              value={driftCount}
              tone={driftCount > 0 ? "amber" : "muted"}
            />
          </div>
          {currentVersion ? (
            <p className="text-xs text-muted-foreground">
              云厂商真源版本：
              <code className="font-mono">{currentVersion.label ?? currentVersion.id}</code>
              （导入于 {currentVersion.importedAt.toLocaleString("zh-CN")}）
            </p>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              尚未导入价目库当前版本（<code className="font-mono">PricingSourceVersion.isCurrent</code>），「云厂商成本（最新）」列将留空。
            </p>
          )}
          <AdminToolBillablePricingClient
            rowPayloads={rowPayloads}
            optionsByKeyJson={optionsByKeyJson}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "emerald" | "amber" | "muted";
}) {
  const valueCls =
    tone === "emerald"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "amber"
        ? "text-amber-700 dark:text-amber-400"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-foreground";
  return (
    <div className="rounded-md border border-border bg-card/40 px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${valueCls}`}>{value}</div>
    </div>
  );
}
