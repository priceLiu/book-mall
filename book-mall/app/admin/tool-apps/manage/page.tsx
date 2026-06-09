import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

export const metadata = {
  title: "工具管理 — 管理后台",
};

export default function AdminToolAppsManagePage() {
  const origin = getFinanceWebPublicOrigin();
  const financeCreditPricing = origin ? `${origin}/admin/credit-pricing` : "/admin";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">工具管理</h1>
        <p className="text-sm text-muted-foreground">
          工具按次计价已迁入财务 2.0 统一积分体系（<code className="text-xs">ModelCreditPrice</code>）。
          模型成本与积分报价请在{" "}
          <a
            href={financeCreditPricing}
            className="font-medium text-primary underline-offset-4 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            财务控制台 · 积分报价
          </a>
          维护。工具站侧栏入口显隐请至{" "}
          <Link
            href="/admin/tool-apps/tool-menu"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            工具菜单
          </Link>
          配置。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>按次单价（已退役）</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            <code className="text-xs">ToolBillablePrice</code> / Scheme A 钱包扣点路径已下线。
            生成扣费经 Gateway → <code className="text-xs">CreditLedger</code>。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
