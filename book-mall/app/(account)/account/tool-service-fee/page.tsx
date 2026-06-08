import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { getServerSession } from "next-auth";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { accountInlineLinkClass } from "@/components/account/account-nav-styles";
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

type ToolServiceFeePlanRow = Awaited<
  ReturnType<typeof listActiveToolServiceFeePlans>
>[number];

type ActiveToolServicePeriodRow = Awaited<
  ReturnType<typeof getActiveToolServicePeriods>
>[number];

function decodeQueryMessage(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

function isSchemaUnavailableError(message: string): boolean {
  return (
    message.includes("ToolServiceFeePlan") ||
    message.includes("UserToolServicePeriod") ||
    message.includes("does not exist") ||
    message.includes("P2021")
  );
}

export default async function AccountToolServiceFeePage({
  searchParams,
}: {
  searchParams?: { error?: string; success?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const errorMessage = decodeQueryMessage(searchParams?.error);
  const showSuccess = searchParams?.success === "1";

  let plans: ToolServiceFeePlanRow[] = [];
  let periods: ActiveToolServicePeriodRow[] = [];
  let gold = {
    balancePoints: 0,
    minBalanceLinePoints: 2000,
    hasRechargeHistory: false,
    isGoldMember: false,
  };
  let loadError: string | null = null;

  try {
    const [planRows, periodRows, goldAccess] = await Promise.all([
      listActiveToolServiceFeePlans(),
      getActiveToolServicePeriods(session.user.id),
      getGoldMemberAccess(session.user.id),
    ]);
    plans = planRows;
    periods = periodRows;
    gold = goldAccess;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    loadError = isSchemaUnavailableError(msg)
      ? "工具月费数据表尚未初始化，请联系管理员在 book-mall 执行 prisma migrate deploy。"
      : "加载工具月费数据失败，请稍后重试。";
  }

  const periodByNav = new Map(periods.map((p) => [p.toolNavKey, p] as const));

  return (
    <div className="space-y-8">
      <AccountSectionHeader
        title="工具技术服务费"
        description={
          <>
            课程会员<strong className="text-foreground">不含</strong>工具使用权。按月从钱包扣固定点数（30
            天/周期）；单次生成走 Gateway BYOK。钱包余额：{" "}
            <span className="font-medium tabular-nums text-foreground">
              {gold.balancePoints.toLocaleString("zh-CN")} 点
            </span>
            （≈ ¥{formatPointsAsYuan(gold.balancePoints)}）·{" "}
            <Link href="/pay/mock-topup" className={accountInlineLinkClass()}>
              充值
            </Link>
          </>
        }
      />

      {showSuccess ? (
        <div
          role="status"
          className="flex gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm"
        >
          <CheckCircle2
            className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-500"
            aria-hidden
          />
          <p className="text-foreground">开通 / 续订成功，服务期已更新。</p>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            aria-hidden
          />
          <p className="leading-relaxed text-muted-foreground">{errorMessage}</p>
        </div>
      ) : null}

      {loadError ? (
        <div
          role="alert"
          className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
        >
          <AlertTriangle
            className="mt-0.5 h-4 w-4 shrink-0 text-destructive"
            aria-hidden
          />
          <p className="leading-relaxed text-muted-foreground">{loadError}</p>
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">开通 / 续订</CardTitle>
            <CardDescription className="text-xs">
              余额不足时无法开通；续订会在当前周期到期日基础上延长 30 天。画布（ai-poster-canvas）、漫剧（story-theater）等独立应用共用本表分组。
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
                {!plans.length ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                      暂无可用工具月费计划，请联系管理员配置 ToolServiceFeePlan。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
