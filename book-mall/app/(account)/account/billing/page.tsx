import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { FileText, ListChecks } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getToolsPublicOrigin } from "@/lib/sso-tools-env";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { accountInlineLinkClass } from "@/components/account/account-nav-styles";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import {
  hrefPricingDisclosureFromAccount,
  PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS,
} from "@/lib/pricing-disclosure-view";

export const metadata = {
  title: "费用与明细 — 个人中心",
};

export default async function AccountBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const financeWebOrigin = getFinanceWebPublicOrigin();
  const toolsPublicOrigin = getToolsPublicOrigin();
  const financeBillingDetailsUrl = financeWebOrigin
    ? `${financeWebOrigin}/fees/billing/details?from=account`
    : null;
  const financeUsageUrl = financeWebOrigin ? `${financeWebOrigin}/fees/usage` : null;
  const financeTeamBillingUrl = financeWebOrigin ? `${financeWebOrigin}/team/billing` : null;
  const toolsExpenseHistoryUrl = toolsPublicOrigin
    ? `${toolsPublicOrigin}/app-history`
    : null;

  return (
    <>
      <AccountSectionHeader
        title="费用与明细"
        description="工具站流水、财务账单与平台价目入口。"
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">明细入口</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            工具站费用明细为工具站内历史流水；账单详情与云账单对齐，须保持主站已登录。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {toolsExpenseHistoryUrl ? (
            <a
              href={toolsExpenseHistoryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={accountInlineLinkClass()}
            >
              <FileText className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              工具站费用明细
            </a>
          ) : (
            <span className="text-xs text-muted-foreground">
              未配置 TOOLS_PUBLIC_ORIGIN，无法直达工具站流水。
            </span>
          )}
          {financeBillingDetailsUrl ? (
            <a
              href={financeBillingDetailsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={accountInlineLinkClass()}
            >
              <ListChecks className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              账单详情（财务控制台）
            </a>
          ) : null}
          {financeUsageUrl ? (
            <a
              href={financeUsageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={accountInlineLinkClass()}
            >
              <ListChecks className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              积分用量中心（财务 2.0）
            </a>
          ) : null}
          {financeTeamBillingUrl ? (
            <a
              href={financeTeamBillingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={accountInlineLinkClass()}
            >
              <ListChecks className="mr-1 inline h-3.5 w-3.5" aria-hidden />
              团队账单（财务 2.0）
            </a>
          ) : null}
          <a href={PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS} className={accountInlineLinkClass()}>
            平台价目表（价格公示）
          </a>
        </CardContent>
      </Card>

      <Card className="mt-6 border-dashed bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">计费与提现政策（摘要）</CardTitle>
          <CardDescription className="text-xs leading-relaxed">
            订阅费不可用余额抵扣；高阶 / 按量依赖余额且须不低于最低可用线；余额提现须先结清应扣未扣。
            完整说明见{" "}
            <a
              href={hrefPricingDisclosureFromAccount({ hash: "billing-policy" })}
              className={accountInlineLinkClass()}
            >
              本站公示
            </a>
            。
          </CardDescription>
        </CardHeader>
      </Card>
    </>
  );
}
