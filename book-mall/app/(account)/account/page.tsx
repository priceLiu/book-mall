import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AlertTriangle, FileText, Receipt, ListChecks } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getMembershipFlags } from "@/lib/membership";
import { formatPointsAsYuan } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { isToolsSsoConfigured, getToolsPublicOrigin } from "@/lib/sso-tools-env";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountDevActions } from "@/components/account/account-dev-actions";
import { WalletRefundRequestForm } from "@/components/account/wallet-refund-request-form";
import { ChangePasswordForm } from "@/components/account/change-password-form";
import { AccountOverviewCards } from "@/components/account/account-overview-cards";

export const metadata = {
  title: "个人中心 — AI Mall",
};

function toolsSsoErrBanner(code: string): { title: string; body: string } | null {
  switch (code) {
    case "TOOLS_ACCESS_DENIED":
      return {
        title: "未能打开 AI 工具站",
        body:
          "当前账号不满足工具站准入：须为主站管理员，或同时具备「黄金会员」（钱包充值记录且不低于最低线）与「有效会员计划 或 单品工具订阅」。请在「钱包余额」与「AI 工具站」概览卡查看具体未满足项。",
      };
    case "SSO_CODE_PERSIST_FAILED":
      return {
        title: "工具站签发失败（数据库）",
        body:
          "写入一次性授权码失败，常见于新库未跑迁移。请在服务器上对 book-mall 执行 `pnpm run db:deploy` 后重启主站，再次尝试。",
      };
    case "TOOLS_SSO_SECRETS_MISSING":
    case "TOOLS_PUBLIC_ORIGIN_INVALID":
    case "TOOLS_SSO_UNAVAILABLE":
      return {
        title: "工具站 SSO 未就绪",
        body:
          "请检查主站环境变量 TOOLS_PUBLIC_ORIGIN、TOOLS_SSO_SERVER_SECRET、TOOLS_SSO_JWT_SECRET 是否已配置且与工具站一致；详见 doc/tech/tools-sso-environment.md。",
      };
    case "TOOLS_SSO_UNKNOWN":
      return {
        title: "工具站跳转被中断",
        body: "签发跳转时出现未知错误。稍后再次点击「打开工具站」即可；若反复出现请查看服务端日志。",
      };
    default:
      return {
        title: "工具站跳转未完成",
        body: `服务端返回代码「${code}」。若刚切换数据库，请先满足黄金会员条件（充值）或确认已对 book-mall 执行数据库迁移后再试。`,
      };
  }
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: { tools_sso_err?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const toolsSsoErr =
    typeof searchParams?.tools_sso_err === "string"
      ? searchParams.tools_sso_err.trim()
      : "";
  const toolsBanner =
    toolsSsoErr.length > 0 ? toolsSsoErrBanner(toolsSsoErr) : null;

  const [flags, walletRefunds, goldAccess, accountSecrets] = await Promise.all([
    getMembershipFlags(session.user.id),
    prisma.walletRefundRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    getGoldMemberAccess(session.user.id),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    }),
  ]);

  const hasPassword = Boolean(accountSecrets?.passwordHash);
  const hasPendingWalletRefund = walletRefunds.some((r) => r.status === "PENDING");

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const canLaunchTools =
    toolsSsoReady &&
    (isAdminUser ||
      (goldAccess.isGoldMember &&
        (flags.hasActiveSubscription || flags.hasActiveToolProductSubscription)));

  const financeWebOrigin = getFinanceWebPublicOrigin();
  const toolsPublicOrigin = getToolsPublicOrigin();
  const financeBillingDetailsUrl = financeWebOrigin
    ? `${financeWebOrigin}/fees/billing/details`
    : null;
  const toolsExpenseHistoryUrl = toolsPublicOrigin
    ? `${toolsPublicOrigin}/app-history`
    : null;

  return (
    <main className="py-6 md:py-8">
      <div className="space-y-6 md:space-y-7">
        {toolsBanner ? (
          <div
            role="alert"
            className="flex gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
            <div className="space-y-1">
              <p className="font-semibold text-destructive">{toolsBanner.title}</p>
              <p className="leading-relaxed text-muted-foreground">{toolsBanner.body}</p>
            </div>
          </div>
        ) : null}

        {/* 标题（薄） */}
        <header className="space-y-1">
          <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            个人中心
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            账户、钱包、订阅与计费明细的统一入口。
            <Link href="/#billing-policy" className="ml-1 text-primary hover:underline">
              查看计费与提现公示 →
            </Link>
          </p>
        </header>

        {/* 1. 概览三卡 */}
        <AccountOverviewCards
          balancePoints={flags.balancePoints}
          minBalanceLinePoints={flags.minBalanceLinePoints}
          canUsePremiumMetered={flags.canUsePremiumMetered}
          hasActiveSubscription={flags.hasActiveSubscription}
          membershipPlanName={flags.membershipPlanName}
          subscriptionEndsAt={flags.subscriptionEndsAt}
          hasActiveToolProductSubscription={flags.hasActiveToolProductSubscription}
          goldIsActive={goldAccess.isGoldMember}
          goldMinBalanceLinePoints={goldAccess.minBalanceLinePoints}
          goldHasRechargeHistory={goldAccess.hasRechargeHistory}
          canLaunchTools={canLaunchTools}
          showToolsCta={toolsSsoReady}
        />

        {/* 2. 费用明细入口 */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" aria-hidden />
              <CardTitle className="text-base">费用与明细</CardTitle>
            </div>
            <CardDescription className="text-xs">
              「工具站费用明细」按次扣费流水（工具站产生）；「财务控制台账单详情」云级账单对齐明细（导入后筛选 / 查对内计价）。
              打开账单详情前请保持本站已登录，以便财务页带会话访问本站接口。
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {toolsExpenseHistoryUrl ? (
              <Button asChild variant="default" size="sm">
                <a href={toolsExpenseHistoryUrl} target="_blank" rel="noopener noreferrer">
                  <FileText className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  工具站费用明细
                </a>
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                工具站地址未配置（TOOLS_PUBLIC_ORIGIN），无法直达费用流水。
              </span>
            )}
            {financeBillingDetailsUrl ? (
              <Button asChild variant="outline" size="sm">
                <a href={financeBillingDetailsUrl} target="_blank" rel="noopener noreferrer">
                  <ListChecks className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  财务控制台账单详情
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline" size="sm">
              <Link href="/account/pricing">我方价目表（按工具 / 模型查询）</Link>
            </Button>
          </CardContent>
        </Card>

        {/* 3. 账户与安全（账号 / 修改密码 并排） */}
        <section className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">账号</CardTitle>
              <CardDescription className="text-xs">登录邮箱与昵称</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <p className="flex items-baseline gap-2">
                <span className="w-12 shrink-0 text-xs text-muted-foreground">邮箱</span>
                <span className="break-all">{session.user.email}</span>
              </p>
              {session.user.name ? (
                <p className="flex items-baseline gap-2">
                  <span className="w-12 shrink-0 text-xs text-muted-foreground">昵称</span>
                  <span>{session.user.name}</span>
                </p>
              ) : null}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">登录密码</CardTitle>
              <CardDescription className="text-xs">
                验证当前密码后更新（仅邮箱密码登录的账号）
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm enabled={hasPassword} />
            </CardContent>
          </Card>
        </section>

        {/* 4. 余额提现 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">余额提现申请</CardTitle>
            <CardDescription className="text-xs">
              提交后由后台核算应扣未扣；处理中金额仍留在钱包，核准后从余额扣减并记流水。
              {hasPendingWalletRefund ? (
                <span className="mt-1 block text-amber-600 dark:text-amber-500">
                  您有一条待审核申请，请勿重复提交。
                </span>
              ) : null}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasPendingWalletRefund ? (
              <p className="mb-3 text-sm text-muted-foreground">
                待审核期间无法再次发起；如需补充说明请联系客服。
              </p>
            ) : (
              <WalletRefundRequestForm />
            )}
            {walletRefunds.length > 0 ? (
              <div className="mt-5 border-t border-border/60 pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground">最近申请</p>
                <ul className="space-y-1.5 text-sm">
                  {walletRefunds.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-muted-foreground tabular-nums"
                    >
                      <span className="text-xs">{r.createdAt.toLocaleString("zh-CN")}</span>
                      <span className="font-medium text-foreground">{r.status}</span>
                      {r.refundAmountPoints != null ? (
                        <span>
                          实提 ¥{formatPointsAsYuan(r.refundAmountPoints)}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* 5. 政策摘要（轻量收尾） */}
        <Card className="border-dashed bg-muted/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">计费与提现政策（摘要）</CardTitle>
            <CardDescription className="text-xs leading-relaxed">
              订阅费不可用余额抵扣；高阶 / 按量依赖余额且须不低于最低可用线；余额提现须先结清应扣未扣。
              完整说明见{" "}
              <Link href="/#billing-policy" className="text-primary underline">
                本站公示
              </Link>
              。
            </CardDescription>
          </CardHeader>
        </Card>

        {process.env.NODE_ENV === "development" ? (
          <section>
            <AccountDevActions />
          </section>
        ) : null}
      </div>
    </main>
  );
}
