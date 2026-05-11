import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { getMembershipFlags } from "@/lib/membership";
import { formatMinorAsYuan } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import { getGoldMemberAccess } from "@/lib/gold-member";
import { isToolsSsoConfigured } from "@/lib/sso-tools-env";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AccountDevActions } from "@/components/account/account-dev-actions";
import { LaunchToolsAppButton } from "@/components/account/launch-tools-app";
import { WalletRefundRequestForm } from "@/components/account/wallet-refund-request-form";

export const metadata = {
  title: "个人中心 — AI Mall",
};

export default async function AccountPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const [flags, walletRefunds, goldAccess] = await Promise.all([
    getMembershipFlags(session.user.id),
    prisma.walletRefundRequest.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    getGoldMemberAccess(session.user.id),
  ]);

  const toolsSsoReady = isToolsSsoConfigured();
  const isAdminUser = session.user.role === "ADMIN";
  const canLaunchTools =
    toolsSsoReady && (goldAccess.isGoldMember || isAdminUser);

  const hasPendingWalletRefund = walletRefunds.some((r) => r.status === "PENDING");

  return (
    <main className="py-10 md:py-14">
      <div className="space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold">个人中心</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            免费注册用户与游客内容权限一致；此处为账户、钱包与订阅入口。计费与退款详见{" "}
            <Link href="/#billing-policy" className="text-primary underline">
              前台公示
            </Link>
            。
          </p>
        </div>

        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">计费与退款（摘要）</CardTitle>
            <CardDescription>
              订阅费不可用余额抵扣；高阶/按量依赖余额且须不低于最低线；余额退款须先结清应扣未扣。完整说明见{" "}
              <Link href="/#billing-policy" className="underline">
                本站公示
              </Link>
              。
            </CardDescription>
          </CardHeader>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 items-start">
          <Card className="sm:col-span-2 xl:col-span-1">
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
              <CardTitle>钱包</CardTitle>
              <CardDescription>
                可用余额（CNY） · 最低可用线 {formatMinorAsYuan(flags.minBalanceLineMinor)}{" "}
                元，可用于高阶/按量服务前置校验
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-2xl font-semibold tabular-nums">
                ¥{formatMinorAsYuan(flags.balanceMinor)}
              </p>
              <p className="text-muted-foreground">
                高级会员状态（可享用高阶/按量）：{" "}
                <span className="font-medium text-foreground">
                  {flags.canUsePremiumMetered ? "是" : "否"}
                </span>
                （需订阅有效且余额不低于最低线）
              </p>
              <div className="pt-3 mt-3 border-t border-secondary space-y-2">
                <p className="text-muted-foreground">
                  黄金会员（独立 AI 工具站准入）：{" "}
                  <span className="font-medium text-foreground">
                    {goldAccess.isGoldMember ? "是" : "否"}
                  </span>
                  （须历史有过充值记录，且余额 ≥ ¥
                  {formatMinorAsYuan(goldAccess.minBalanceLineMinor)}）
                </p>
                <LaunchToolsAppButton
                  enabled={canLaunchTools}
                  helperText={
                    !toolsSsoReady
                      ? "工具站跳转未启用：请在服务端配置 TOOLS_PUBLIC_ORIGIN、TOOLS_SSO_SERVER_SECRET、TOOLS_SSO_JWT_SECRET（见 doc/tech/tools-sso-environment.md）。"
                      : !goldAccess.isGoldMember && !isAdminUser
                        ? !goldAccess.hasRechargeHistory
                          ? "请先完成至少一笔钱包充值入账（或通过管理员账号从后台进入工具站调试）。"
                          : `余额需不低于 ¥${formatMinorAsYuan(goldAccess.minBalanceLineMinor)}（当前 ¥${formatMinorAsYuan(goldAccess.balanceMinor)}）；或通过管理员账号从后台进入工具站调试。`
                        : isAdminUser && !goldAccess.isGoldMember
                          ? "当前以管理员身份直通工具站（不要求黄金会员）；普通用户仍需黄金会员。"
                          : "将跳转至独立部署的工具站（默认路径 /fitting-room）；需在工具项目实现回调与换票。"
                  }
                />
              </div>
              <Button asChild variant="secondary" size="sm" className="mt-2 w-full sm:w-auto">
                <Link href="/pay/mock-topup">钱包充值（模拟收银）</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>订阅</CardTitle>
              <CardDescription>周期性订阅与普通型权益</CardDescription>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                状态：{" "}
                <span className="font-medium">
                  {flags.hasActiveSubscription ? "订阅有效" : "未订阅 / 已过期"}
                </span>
              </p>
              {flags.subscriptionEndsAt ? (
                <p className="text-muted-foreground">
                  当前周期至：{flags.subscriptionEndsAt.toLocaleString("zh-CN")}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="sm:col-span-2 xl:col-span-3">
            <CardHeader>
              <CardTitle>余额退款申请（6.3）</CardTitle>
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
                        <span>实退 ¥{formatMinorAsYuan(r.refundAmountMinor)}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          {process.env.NODE_ENV === "development" ? (
            <div className="sm:col-span-2 xl:col-span-3 w-full">
              <AccountDevActions />
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
