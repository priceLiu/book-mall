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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AccountSectionHeader } from "@/components/account/account-section-header";
import {
  aggregateUsageByModel,
  getCreditBalance,
  listUsageRecords,
} from "@/lib/billing/credit-account-service";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "积分用量中心 — 个人中心",
};

const STATUS_LABEL: Record<string, string> = {
  SUCCEEDED: "成功",
  FAILED: "失败",
  RUNNING: "进行中",
  PENDING: "待处理",
  CANCELLED: "已取消",
};

export default async function AccountUsagePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const [balance, byModel, recent] = await Promise.all([
    getCreditBalance({ ownerType: "USER", ownerId: userId }),
    aggregateUsageByModel({ userId }),
    listUsageRecords({ userId, take: 50 }),
  ]);

  const totalConsumed = byModel.reduce((s, m) => s + m.creditsCharged, 0);

  return (
    <>
      <AccountSectionHeader
        title="积分用量中心"
        description="按模型查看积分消耗与生成次数，下钻每次生成的细颗粒记录。失败 / 取消自动返还。"
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">当前积分余额</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{balance.toLocaleString()}</div>
            <CardDescription>可用于全站 AI 应用</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">累计消耗</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalConsumed.toLocaleString()}</div>
            <CardDescription>历史扣减积分</CardDescription>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">使用模型数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{byModel.length}</div>
            <CardDescription>归口标准模型</CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">按模型聚合</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型</TableHead>
                <TableHead className="text-right">生成次数</TableHead>
                <TableHead className="text-right">消耗积分</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byModel.map((m) => (
                <TableRow key={m.canonicalModelKey}>
                  <TableCell className="font-medium">{m.canonicalModelKey}</TableCell>
                  <TableCell className="text-right">{m.count.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-semibold">{m.creditsCharged.toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {byModel.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                    暂无用量记录
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-base">最近生成记录</CardTitle>
          <CardDescription>共 {recent.total.toLocaleString()} 条，展示最近 50 条</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>模型</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>计费</TableHead>
                <TableHead className="text-right">积分</TableHead>
                <TableHead>状态</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recent.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {r.submittedAt.toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell className="font-medium">{r.canonicalModelKey ?? r.model}</TableCell>
                  <TableCell>{r.requestKind}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.clientSource}</TableCell>
                  <TableCell>
                    {r.billingMode === "BYOK" ? (
                      <Badge variant="outline">BYOK</Badge>
                    ) : r.billingMode === "PLATFORM_CREDIT" ? (
                      <Badge variant="secondary">积分</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{r.creditsCharged != null ? r.creditsCharged : "—"}</TableCell>
                  <TableCell>
                    <span className={r.status === "FAILED" ? "text-red-600" : ""}>
                      {STATUS_LABEL[r.status] ?? r.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {recent.rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    暂无生成记录
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
