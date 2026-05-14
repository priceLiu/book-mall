import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AdminToolBillablePricingClient } from "@/components/admin/admin-tool-billable-pricing";
import { buildRowPayloads } from "@/lib/tool-billable-row-payloads";
import { loadSchemeAModelCatalog } from "@/lib/tool-billable-scheme-a-admin-cost";
import { resolveInitialCostMultForBillableRow } from "@/lib/tool-billable-row-initial";

export const metadata = {
  title: "工具管理 — 管理后台",
};

export default async function AdminToolAppsManagePage() {
  const [prices, catalog] = await Promise.all([
    prisma.toolBillablePrice.findMany({
      orderBy: [
        { active: "desc" },
        { toolKey: "asc" },
        { schemeARefModelKey: "asc" },
        { effectiveFrom: "desc" },
        { updatedAt: "desc" },
      ],
    }),
    loadSchemeAModelCatalog(),
  ]);

  const initials = await Promise.all(prices.map((p) => resolveInitialCostMultForBillableRow(p)));
  const rowPayloads = buildRowPayloads(prices, initials);
  const optionsByKeyJson = JSON.stringify(catalog.optionsByKey);

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
          <CardDescription>
            已有行<strong className="text-foreground">仅当生效止为空</strong>时可填<strong className="text-foreground">一次</strong>结束时间；已设结束时间后不可再改。
            调价请用下方<strong className="text-foreground">新增定价</strong>（新 <code className="text-xs">effectiveFrom</code>），必要时给旧行填生效止以闭合区间。
            「新增」仍依价目库与 <code className="text-xs">pricing-catalog-sync-map.json</code> 预填成本，再填 M 写入 <code className="text-xs">pricePoints</code>（100 点 = 1 元）。
            各行 <strong className="text-foreground">M</strong> 经 SSO{" "}
            <code className="text-xs">/api/sso/tools/scheme-a-retail-multiplier</code> 解析。
            <strong className="text-foreground"> 系统不会</strong>自动写入 missing 配置；新模型须同步工具站（§5.4.6）。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <AdminToolBillablePricingClient
            rowPayloads={rowPayloads}
            optionsByKeyJson={optionsByKeyJson}
          />
        </CardContent>
      </Card>
    </div>
  );
}
