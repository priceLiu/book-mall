import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatPointsAsYuan } from "@/lib/currency";
import { TOOL_NAV_LABEL } from "@/lib/tool-nav-labels";
import type { ToolSuiteNavKey } from "@/lib/tool-suite-nav-keys";
import { activateToolServiceFeeAction } from "@/app/actions/activate-tool-service-fee";
import { listActiveToolServiceFeePlans } from "@/lib/tool-service-fee/charge-monthly";
import { getActiveToolServicePeriods } from "@/lib/tool-service-fee/periods";
import { getGoldMemberAccess } from "@/lib/gold-member";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "工具技术服务费 — AI Mall",
};

export default async function AccountToolServiceFeePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [plans, periods, gold] = await Promise.all([
    listActiveToolServiceFeePlans(),
    getActiveToolServicePeriods(session.user.id),
    getGoldMemberAccess(session.user.id),
  ]);

  const periodByNav = new Map(periods.map((p) => [p.toolNavKey, p] as const));

  return (
    <main className="mx-auto max-w-5xl space-y-8 px-4 py-8 md:py-10">
      <div className="max-w-3xl space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/account/subscription" className="text-primary underline">
            ← 订阅中心
          </Link>
        </p>
        <h1 className="text-2xl font-bold md:text-3xl">工具技术服务费</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          课程会员订阅<strong className="text-foreground">仅覆盖 AI 学堂</strong>，不含工具使用权。
          使用 AI 工具须开通对应分组的<strong className="text-foreground">按月技术服务费</strong>
          （从钱包扣固定点数，每周期 30 天）；单次生成走 Gateway BYOK，Book 不对每次生成扣点。
        </p>
        <p className="text-sm text-muted-foreground">
          钱包余额：<span className="font-medium tabular-nums text-foreground">
            {gold.balancePoints.toLocaleString("zh-CN")} 点
          </span>
          （≈ ¥{formatPointsAsYuan(gold.balancePoints)}）·{" "}
          <Link href="/pay/mock-topup" className="text-primary underline">
            充值
          </Link>
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">开通 / 续订</CardTitle>
          <CardDescription className="text-xs">
            余额不足时无法开通；续订会在当前周期到期日基础上延长 30 天。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-secondary">
              <tr className="text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">工具分组</th>
                <th className="pb-2 pr-4 font-medium whitespace-nowrap">月费</th>
                <th className="pb-2 pr-4 font-medium whitespace-nowrap">服务期至</th>
                <th className="pb-2 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const period = periodByNav.get(plan.toolNavKey as ToolSuiteNavKey);
                const navLabel = TOOL_NAV_LABEL[plan.toolNavKey] ?? plan.toolNavKey;
                const fee = plan.monthlyFeePoints;
                return (
                  <tr key={plan.id} className="border-b border-secondary/60 align-top">
                    <td className="py-3 pr-4">
                      <span className="block font-medium">{plan.label}</span>
                      <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                        {plan.toolNavKey} · {navLabel}
                      </span>
                    </td>
                    <td className="py-3 pr-4 tabular-nums whitespace-nowrap">
                      {fee === 0 ? (
                        "免费"
                      ) : (
                        <>
                          {fee.toLocaleString("zh-CN")} 点
                          <span className="ml-1 text-muted-foreground">
                            （¥{formatPointsAsYuan(fee)}）
                          </span>
                        </>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">
                      {period
                        ? period.periodEnd.toLocaleString("zh-CN")
                        : "—"}
                    </td>
                    <td className="py-3">
                      {fee === 0 ? (
                        <span className="text-xs text-muted-foreground">随工具站 SSO 开放</span>
                      ) : (
                        <form action={activateToolServiceFeeAction}>
                          <input type="hidden" name="toolNavKey" value={plan.toolNavKey} />
                          <Button type="submit" size="sm" variant="subscription">
                            {period ? "续订 30 天" : "开通 30 天"}
                          </Button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </main>
  );
}
