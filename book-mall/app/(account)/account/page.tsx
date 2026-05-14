import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getMembershipFlags } from "@/lib/membership";
import { formatMinorAsYuan } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
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
import { Separator } from "@/components/ui/separator";

export const metadata = {
  title: "个人中心 — AI Mall",
};

function toolsSsoErrBanner(code: string): { title: string; body: string } | null {
  switch (code) {
    case "TOOLS_ACCESS_DENIED":
      return {
        title: "未能打开 AI 工具站",
        body:
          "当前账号不满足工具站准入：须为主站管理员，或同时具备「黄金会员」（钱包充值记录且不低于最低线）与「有效会员计划 **或** 单品工具订阅」。请在钱包卡片查看充值状态，在订阅中心办理会员或工具单品后再试。",
      };
    case "SSO_CODE_PERSIST_FAILED":
      return {
        title: "工具站签发失败（数据库）",
        body:
          "写入一次性授权码失败，常见于新库未跑迁移。请在服务器上对 book-mall 执行 `pnpm run db:deploy`（或 `prisma migrate deploy`）后重启主站，再从个人中心重新打开工具站。",
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
        body:
          "签发跳转时出现未知错误。请稍后从个人中心再次点击「打开工具站」，若反复出现请查看主站服务端日志。",
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

  return (
    <main className="py-10 md:py-14">
      <div className="space-y-8">
        {toolsBanner ? (
          <div
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-foreground"
          >
            <p className="font-semibold text-destructive">{toolsBanner.title}</p>
            <p className="mt-1.5 leading-relaxed text-muted-foreground">{toolsBanner.body}</p>
          </div>
        ) : null}
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">个人中心</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            免费注册用户与游客内容权限一致；此处为账户、钱包与订阅入口。计费与提现详见{" "}
            <Link href="/#billing-policy" className="text-primary underline">
              前台公示
            </Link>
            。
          </p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">计费与提现（摘要）</CardTitle>
            <CardDescription>
              订阅费不可用余额抵扣；高阶/按量依赖余额且须不低于最低线；余额提现须先结清应扣未扣。完整说明见{" "}
              <Link href="/#billing-policy" className="underline">
                本站公示
              </Link>
              。
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">账户与安全</h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>账号</CardTitle>
                <CardDescription>{session.user.email}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                {session.user.name ? <p>昵称：{session.user.name}</p> : null}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>登录密码</CardTitle>
                <CardDescription>验证当前密码后更新；适用于邮箱密码登录的账号</CardDescription>
              </CardHeader>
              <CardContent>
                <ChangePasswordForm enabled={hasPassword} />
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">钱包与订阅</h2>
            <Separator className="flex-1" />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>钱包</CardTitle>
                <CardDescription>
                  可用余额（CNY） · 最低可用线 {formatMinorAsYuan(flags.minBalanceLineMinor)}{" "}
                  元；独立 AI 工具站须黄金会员 +（会员计划或单品工具订阅），请从顶部菜单进入工具站。
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm flex-1 flex flex-col">
                <p className="text-2xl font-semibold tabular-nums">
                  ¥{formatMinorAsYuan(flags.balanceMinor)}
                </p>
                <p className="text-muted-foreground">
                  高级会员状态（可享用高阶/按量）：{" "}
                  <span className="font-medium text-foreground">
                    {flags.canUsePremiumMetered ? "是" : "否"}
                  </span>
                  （需会员计划有效且余额不低于最低线）
                </p>
                <div className="pt-3 mt-auto border-t border-secondary space-y-2">
                  <p className="text-muted-foreground">
                    黄金会员（独立 AI 工具站准入）：{" "}
                    <span className="font-medium text-foreground">
                      {goldAccess.isGoldMember ? "是" : "否"}
                    </span>
                    （须历史有过充值记录，且余额 ≥ ¥
                    {formatMinorAsYuan(goldAccess.minBalanceLineMinor)}）
                  </p>
                </div>
                <Button asChild variant="subscription" size="sm" className="mt-2 w-full sm:w-auto">
                  <Link href="/pay/mock-topup">钱包充值（模拟收银）</Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="h-full flex flex-col">
              <CardHeader className="space-y-1 pb-2">
                <CardTitle>订阅中心</CardTitle>
                <CardDescription>
                  会员订阅、AI 课程订阅、AI 工具订阅、订单记录均在此管理
                </CardDescription>
              </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-0 px-6 pb-6 pt-0 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-border/60 pb-5">
                  <p className="min-w-[7rem]">
                    状态：{" "}
                    <span className="font-medium text-foreground">
                      {flags.hasActiveSubscription ? "有效" : "未开通 / 已过期"}
                    </span>
                  </p>
                  <p className="min-w-[7rem]">
                    套餐：{" "}
                    <span className="font-medium text-foreground">
                      {flags.membershipPlanName ?? "—"}
                    </span>
                  </p>
                  <p className="min-w-[7rem]">
                    有效期：{" "}
                    <span className="font-medium text-foreground tabular-nums">
                      {flags.subscriptionEndsAt
                        ? flags.subscriptionEndsAt.toLocaleString("zh-CN")
                        : "—"}
                    </span>
                  </p>
                  <p className="min-w-[7rem]">
                    单品工具：{" "}
                    <span className="font-medium text-foreground">
                      {flags.hasActiveToolProductSubscription ? "有" : "无"}
                    </span>
                  </p>
                </div>
                <div className="mt-auto flex flex-row flex-wrap items-center justify-center gap-3 pt-8">
                  <Button
                    asChild
                    variant="subscription"
                    className="h-10 min-h-10 min-w-[12rem] max-w-[16rem] shrink-0"
                  >
                    <Link href="/account/subscription">打开订阅中心</Link>
                  </Button>
                  <Button
                    asChild
                    variant="subscription"
                    className="h-10 min-h-10 min-w-[12rem] max-w-[16rem] shrink-0"
                  >
                    <Link href="/courses">进入 AI 学堂</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold tracking-tight">提现与服务</h2>
            <Separator className="flex-1" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>余额提现申请（6.3）</CardTitle>
              <CardDescription>
                提交后由后台核算应扣未扣；处理中金额仍留在钱包，核准后从余额扣减并记流水。
                {hasPendingWalletRefund ? (
                  <span className="block mt-1 text-amber-600 dark:text-amber-500">
                    您有一条待审核申请，请勿重复提交。
                  </span>
                ) : null}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasPendingWalletRefund ? (
                <p className="text-sm text-muted-foreground mb-4">
                  待审核期间无法再次发起；如需补充说明请联系客服。
                </p>
              ) : (
                <WalletRefundRequestForm />
              )}
              {walletRefunds.length > 0 ? (
                <ul className="mt-6 space-y-2 text-sm border-t border-secondary pt-4">
                  {walletRefunds.map((r) => (
                    <li key={r.id} className="flex flex-wrap gap-2 text-muted-foreground">
                      <span>{r.createdAt.toLocaleString("zh-CN")}</span>
                      <span className="font-medium text-foreground">{r.status}</span>
                      {r.refundAmountMinor != null ? (
                        <span>实提 ¥{formatMinorAsYuan(r.refundAmountMinor)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {process.env.NODE_ENV === "development" ? (
          <section className="pt-2">
            <AccountDevActions />
          </section>
        ) : null}
      </div>
    </main>
  );
}
