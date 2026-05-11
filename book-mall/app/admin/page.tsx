import { prisma } from "@/lib/prisma";
import { formatMinorAsYuan } from "@/lib/currency";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AdminDashboardPage() {
  const now = new Date();
  const [userCount, activeSubscriptions, balanceSum] = await prisma.$transaction([
    prisma.user.count(),
    prisma.subscription.count({
      where: { status: "ACTIVE", currentPeriodEnd: { gt: now } },
    }),
    prisma.wallet.aggregate({ _sum: { balanceMinor: true } }),
  ]);

  const totalBalance = balanceSum._sum.balanceMinor ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">概览</h1>
        <p className="text-sm text-muted-foreground">
          首期后台：用户规模、订阅与余额汇总；详细能力见{" "}
          <code className="rounded bg-muted px-1 text-xs">doc/product/05-admin.md</code>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>注册用户</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{userCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>有效订阅</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {activeSubscriptions}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>全站可用余额（CNY）</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              ¥{formatMinorAsYuan(totalBalance)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground pt-0">
            各用户钱包余额之和，供水位监控参考
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
