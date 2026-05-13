import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatMinorAsYuan } from "@/lib/currency";
import { TOOL_NAV_LABEL } from "@/lib/tool-nav-labels";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { subscribeProductMock, cancelProductSubscriptionMock } from "@/app/actions/subscribe-product";

export const metadata = {
  title: "订阅中心 — AI Mall",
};

function orderTypeLabel(t: string): string {
  switch (t) {
    case "SUBSCRIPTION":
      return "会员订阅";
    case "WALLET_TOPUP":
      return "钱包充值";
    case "PRODUCT_SUBSCRIPTION":
      return "单品订阅（课程/工具）";
    default:
      return t;
  }
}

export default async function AccountSubscriptionPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const now = new Date();

  const [toolCatalog, courseCatalog, productSubs, orders, membershipSub] = await Promise.all([
    prisma.product.findMany({
      where: { kind: "TOOL", status: "PUBLISHED" },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.product.findMany({
      where: { kind: "KNOWLEDGE", status: "PUBLISHED" },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.userProductSubscription.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
      },
      include: { product: true },
      orderBy: { currentPeriodEnd: "desc" },
    }),
    prisma.order.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.subscription.findFirst({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodEnd: "desc" },
      include: { plan: true },
    }),
  ]);

  const toolSubByProductId = new Map(
    productSubs.filter((s) => s.product.kind === "TOOL").map((s) => [s.productId, s]),
  );
  const courseSubByProductId = new Map(
    productSubs.filter((s) => s.product.kind === "KNOWLEDGE").map((s) => [s.productId, s]),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-10 space-y-10">
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          <Link href="/account" className="text-primary underline">
            ← 返回个人中心
          </Link>
        </p>
        <h1 className="text-2xl md:text-3xl font-bold">订阅中心</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
          会员计划、AI 课程单品与 AI 工具单品互相关联：打开工具站仍需<strong className="text-foreground">
            黄金会员
          </strong>
          （充值记录 + 余额不低于最低线），并须具备<strong className="text-foreground">
            会员计划或单品工具订阅
          </strong>
          之一；课程学习支持会员计划<strong className="text-foreground">或</strong>
          单品课程订阅。
        </p>
      </div>

      {/* 第一版块：会员订阅 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">会员订阅</h2>
        <Card>
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base">会员订阅</CardTitle>
            <CardDescription>月度 / 年度计划 · 与钱包充值独立</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 text-sm">
              <p className="min-w-[7rem]">
                状态：{" "}
                <span className="font-medium text-foreground">
                  {membershipSub ? "有效" : "未开通或已过期"}
                </span>
              </p>
              <p className="min-w-[7rem]">
                套餐：{" "}
                <span className="font-medium text-foreground">
                  {membershipSub?.plan.name ?? "—"}
                </span>
              </p>
              <p className="min-w-[7rem]">
                有效期：{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {membershipSub
                    ? membershipSub.currentPeriodEnd.toLocaleString("zh-CN")
                    : "—"}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="subscription">
                <Link href="/subscribe">前往订阅与支付</Link>
              </Button>
              {process.env.NODE_ENV === "development" ? (
                <Button asChild size="sm" variant="outline" className="border-orange-500/60 text-orange-700 hover:bg-orange-500/10 dark:text-orange-300">
                  <Link href="/pay/mock-subscribe">模拟开通会员（开发）</Link>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 第二版块：AI 工具订阅 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">AI 工具订阅</h2>
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            {toolCatalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无上架工具商品。</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-secondary">
                  <tr className="text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium align-bottom w-[12rem]">工具名</th>
                    <th className="pb-2 pr-4 font-medium align-bottom">简单介绍</th>
                    <th className="pb-2 pr-4 font-medium align-bottom whitespace-nowrap w-[11rem]">
                      订阅时间
                    </th>
                    <th className="pb-2 pr-4 font-medium align-bottom whitespace-nowrap w-[7rem]">
                      状态
                    </th>
                    <th className="pb-2 font-medium align-bottom w-[10rem]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {toolCatalog.map((p) => {
                    const sub = toolSubByProductId.get(p.id);
                    const navHint = p.toolNavKey
                      ? `${p.toolNavKey}${TOOL_NAV_LABEL[p.toolNavKey] ? ` · ${TOOL_NAV_LABEL[p.toolNavKey]}` : ""}`
                      : null;
                    const canSubscribe =
                      Boolean(p.toolNavKey?.trim()) && !p.catalogUnavailable;
                    return (
                      <tr key={p.id} className="border-b border-secondary/60 align-top">
                        <td className="py-3 pr-4">
                          <span className="font-medium text-foreground block">{p.title}</span>
                          {navHint ? (
                            <span className="text-xs text-muted-foreground block mt-0.5 font-mono">
                              {navHint}
                            </span>
                          ) : null}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground leading-relaxed">
                          {p.summary || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">
                          {sub
                            ? `${sub.currentPeriodStart.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} – ${sub.currentPeriodEnd.toLocaleString("zh-CN")}`
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {sub ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              订阅中
                            </span>
                          ) : !canSubscribe ? (
                            <span className="text-amber-600 dark:text-amber-400">不可订</span>
                          ) : (
                            <span className="text-muted-foreground">未订阅</span>
                          )}
                        </td>
                        <td className="py-3">
                          {sub ? (
                            <form action={cancelProductSubscriptionMock}>
                              <input type="hidden" name="productId" value={p.id} />
                              <Button type="submit" size="sm" variant="outline" className="whitespace-nowrap">
                                取消订阅
                              </Button>
                            </form>
                          ) : canSubscribe ? (
                            <form action={subscribeProductMock}>
                              <input type="hidden" name="productId" value={p.id} />
                              <Button type="submit" size="sm" variant="subscription" className="whitespace-nowrap">
                                订阅
                              </Button>
                            </form>
                          ) : (
                            <Button type="button" size="sm" variant="outline" disabled className="whitespace-nowrap">
                              暂不可订
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 第三版块：AI 课程 */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">AI 课程</h2>
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            {courseCatalog.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无上架课程商品。</p>
            ) : (
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-secondary">
                  <tr className="text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium align-bottom w-[12rem]">课程名</th>
                    <th className="pb-2 pr-4 font-medium align-bottom">简单介绍</th>
                    <th className="pb-2 pr-4 font-medium align-bottom whitespace-nowrap w-[11rem]">
                      订阅时间
                    </th>
                    <th className="pb-2 pr-4 font-medium align-bottom whitespace-nowrap w-[7rem]">
                      状态
                    </th>
                    <th className="pb-2 font-medium align-bottom w-[12rem]">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {courseCatalog.map((p) => {
                    const sub = courseSubByProductId.get(p.id);
                    const canSubscribe = !p.catalogUnavailable;
                    return (
                      <tr key={p.id} className="border-b border-secondary/60 align-top">
                        <td className="py-3 pr-4 font-medium text-foreground">{p.title}</td>
                        <td className="py-3 pr-4 text-muted-foreground leading-relaxed">
                          {p.summary || "—"}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground tabular-nums whitespace-nowrap">
                          {sub
                            ? `${sub.currentPeriodStart.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })} – ${sub.currentPeriodEnd.toLocaleString("zh-CN")}`
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          {sub ? (
                            <span className="font-medium text-emerald-600 dark:text-emerald-400">
                              订阅中
                            </span>
                          ) : !canSubscribe ? (
                            <span className="text-amber-600 dark:text-amber-400">不可订</span>
                          ) : (
                            <span className="text-muted-foreground">未订阅</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex flex-col gap-2 items-start">
                            <Button asChild size="sm" variant="outline" className="whitespace-nowrap">
                              <Link href={`/courses/${p.slug}`}>查看课程</Link>
                            </Button>
                            {sub ? (
                              <form action={cancelProductSubscriptionMock}>
                                <input type="hidden" name="productId" value={p.id} />
                                <Button type="submit" size="sm" variant="outline" className="whitespace-nowrap">
                                  取消订阅
                                </Button>
                              </form>
                            ) : canSubscribe ? (
                              <form action={subscribeProductMock}>
                                <input type="hidden" name="productId" value={p.id} />
                                <Button type="submit" size="sm" variant="subscription" className="whitespace-nowrap">
                                  订阅
                                </Button>
                              </form>
                            ) : (
                              <Button type="button" size="sm" variant="outline" disabled className="whitespace-nowrap">
                                暂不可订
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="py-2">
        <div className="mx-auto flex max-w-2xl flex-row flex-wrap items-center justify-center gap-4 px-4">
          <Button asChild variant="subscription" className="h-11 min-h-11 min-w-[14rem] max-w-xs shrink-0">
            <Link href="/courses">AI 课程</Link>
          </Button>
          <Button asChild variant="subscription" className="h-11 min-h-11 min-w-[14rem] max-w-xs shrink-0">
            <Link href="/products/ai-apps">AI 应用</Link>
          </Button>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">订单记录</h2>
        <Card>
          <CardContent className="pt-6 overflow-x-auto">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无订单。</p>
            ) : (
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-secondary">
                  <tr className="text-muted-foreground">
                    <th className="pb-2 font-medium">时间</th>
                    <th className="pb-2 font-medium">类型</th>
                    <th className="pb-2 font-medium">状态</th>
                    <th className="pb-2 font-medium">金额</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-secondary/60 align-top">
                      <td className="py-2 whitespace-nowrap text-muted-foreground">
                        {o.createdAt.toLocaleString("zh-CN")}
                      </td>
                      <td className="py-2">{orderTypeLabel(o.type)}</td>
                      <td className="py-2">{o.status}</td>
                      <td className="py-2 tabular-nums">¥{formatMinorAsYuan(o.amountMinor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
