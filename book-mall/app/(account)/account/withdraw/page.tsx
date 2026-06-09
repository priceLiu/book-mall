import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

export const metadata = {
  title: "余额提现 — 个人中心",
};

export default async function AccountWithdrawPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const financeOrigin = getFinanceWebPublicOrigin();

  return (
    <>
      <AccountSectionHeader
        title="余额提现"
        description="财务 2.0 已退役钱包提现；历史申请只读保留。"
      />
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">钱包提现已关闭</CardTitle>
          <CardDescription className="text-xs">
            新交易统一走积分账户。充值请使用积分加油包；账单与用量请前往财务控制台。
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {financeOrigin ? (
            <p>
              <a
                href={`${financeOrigin}/fees/usage`}
                className="font-medium text-primary underline-offset-4 hover:underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                打开财务控制台 · 费用与用量
              </a>
            </p>
          ) : (
            <p>请从账户「账单与用量」入口查看积分流水。</p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
