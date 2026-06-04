import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { formatPointsAsYuan } from "@/lib/currency";
import { prisma } from "@/lib/prisma";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { WalletRefundRequestForm } from "@/components/account/wallet-refund-request-form";
import { AccountSectionHeader } from "@/components/account/account-section-header";

export const metadata = {
  title: "余额提现 — 个人中心",
};

export default async function AccountWithdrawPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const walletRefunds = await prisma.walletRefundRequest.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  const hasPendingWalletRefund = walletRefunds.some((r) => r.status === "PENDING");

  return (
    <>
      <AccountSectionHeader
        title="余额提现"
        description="提交后由后台核算应扣未扣；核准后从钱包扣减并记流水。"
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">提现申请</CardTitle>
          <CardDescription className="text-xs">
            {hasPendingWalletRefund ? (
              <span className="text-amber-600 dark:text-amber-500">
                您有一条待审核申请，请勿重复提交。
              </span>
            ) : (
              "处理中金额仍留在钱包，直至审核完成。"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hasPendingWalletRefund ? (
            <p className="text-sm text-muted-foreground">
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
                      <span>实提 ¥{formatPointsAsYuan(r.refundAmountPoints)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
