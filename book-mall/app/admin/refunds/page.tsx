import { prisma } from "@/lib/prisma";
import { formatMinorAsYuan } from "@/lib/currency";
import {
  completeWalletRefund,
  rejectWalletRefund,
  completeSubscriptionRefund,
  rejectSubscriptionRefund,
} from "@/app/actions/refunds";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata = {
  title: "退款审核 — 管理后台",
};

export default async function AdminRefundsPage() {
  const [walletReqs, subReqs] = await Promise.all([
    prisma.walletRefundRequest.findMany({
      take: 80,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
    prisma.subscriptionRefundRequest.findMany({
      take: 80,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true } } },
    }),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold">退款审核（6.3 / 5.3）</h1>
        <p className="text-sm text-muted-foreground">
          余额退款：核算应扣未扣后从钱包扣减并记流水；订阅退款：核准后结束订阅并标记订单
          <code className="mx-1 rounded bg-muted px-1 text-xs">refundedAt</code>。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>余额退款申请</CardTitle>
          <CardDescription>待处理优先关注 PENDING</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {walletReqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无记录</p>
          ) : (
            walletReqs.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-secondary p-4 space-y-3"
              >
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground">用户</span>：{r.user.email}
                  </span>
                  <span>
                    <span className="text-muted-foreground">状态</span>：{r.status}
                  </span>
                  <span>
                    <span className="text-muted-foreground">申请额</span>：
                    {r.requestedAmountMinor == null
                      ? "全额（由后台核算）"
                      : `¥${formatMinorAsYuan(r.requestedAmountMinor)}`}
                  </span>
                  <span className="text-muted-foreground">
                    {r.createdAt.toLocaleString("zh-CN")}
                  </span>
                </div>
                {r.userNote ? (
                  <p className="text-sm">
                    <span className="text-muted-foreground">用户留言：</span>
                    {r.userNote}
                  </p>
                ) : null}
                {r.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-6">
                    <form action={completeWalletRefund} className="space-y-2 max-w-md">
                      <input type="hidden" name="id" value={r.id} />
                      <div>
                        <Label htmlFor={`ps-${r.id}`}>应扣未扣（分）</Label>
                        <Input
                          id={`ps-${r.id}`}
                          name="pendingSettlementMinor"
                          type="number"
                          min={0}
                          defaultValue={0}
                          required
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`ov-${r.id}`}>退款额覆盖（分，可选）</Label>
                        <Input
                          id={`ov-${r.id}`}
                          name="refundAmountMinorOverride"
                          type="number"
                          min={0}
                          className="mt-1"
                          placeholder="留空则自动按公式"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`n1-${r.id}`}>备注</Label>
                        <Input id={`n1-${r.id}`} name="adminNote" className="mt-1" />
                      </div>
                      <Button type="submit" size="sm">
                        核准并完成扣减
                      </Button>
                    </form>
                    <form action={rejectWalletRefund} className="space-y-2">
                      <input type="hidden" name="id" value={r.id} />
                      <Input name="adminNote" placeholder="驳回原因" />
                      <Button type="submit" size="sm" variant="destructive">
                        驳回
                      </Button>
                    </form>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    处理结果：实退{" "}
                    {r.refundAmountMinor != null
                      ? `¥${formatMinorAsYuan(r.refundAmountMinor)}`
                      : "—"}
                    {r.adminNote ? ` · ${r.adminNote}` : ""}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>订阅退款审核</CardTitle>
          <CardDescription>来自「订阅与充值 → 发起退款审核」</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {subReqs.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无记录</p>
          ) : (
            subReqs.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-secondary p-4 space-y-3"
              >
                <div className="flex flex-wrap gap-4 text-sm">
                  <span>
                    <span className="text-muted-foreground">用户</span>：{r.user.email}
                  </span>
                  <span>
                    <span className="text-muted-foreground">状态</span>：{r.status}
                  </span>
                  <span>
                    <span className="text-muted-foreground">订单</span>：{r.orderId ?? "—"}
                  </span>
                  <span className="text-muted-foreground">
                    {r.createdAt.toLocaleString("zh-CN")}
                  </span>
                </div>
                {r.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-6">
                    <form action={completeSubscriptionRefund} className="space-y-2">
                      <input type="hidden" name="id" value={r.id} />
                      <Input name="adminNote" placeholder="备注（可选）" />
                      <Button type="submit" size="sm">
                        核准（结束订阅 + 标记订单）
                      </Button>
                    </form>
                    <form action={rejectSubscriptionRefund} className="space-y-2">
                      <input type="hidden" name="id" value={r.id} />
                      <Input name="adminNote" placeholder="驳回原因" />
                      <Button type="submit" size="sm" variant="destructive">
                        驳回
                      </Button>
                    </form>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {r.adminNote ? r.adminNote : "已处理"}
                  </p>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
