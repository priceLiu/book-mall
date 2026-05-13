import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { subscribeProductMock, cancelProductSubscriptionMock } from "@/app/actions/subscribe-product";
import { TOOL_NAV_LABEL } from "@/lib/tool-nav-labels";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "AI 工具订阅 — AI Mall",
};

export default async function AccountSubscriptionToolsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const now = new Date();

  const [catalog, activeRows] = await Promise.all([
    prisma.product.findMany({
      where: { kind: "TOOL", status: "PUBLISHED" },
      orderBy: [{ featuredSort: "asc" }, { updatedAt: "desc" }],
    }),
    prisma.userProductSubscription.findMany({
      where: {
        userId: session.user.id,
        status: "ACTIVE",
        currentPeriodEnd: { gt: now },
        product: { kind: "TOOL" },
      },
    }),
  ]);

  const subByProductId = new Map(activeRows.map((r) => [r.productId, r]));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-10 space-y-8">
      <div className="space-y-2 max-w-3xl">
        <p className="text-sm text-muted-foreground">
          <Link href="/account/subscription" className="text-primary underline">
            ← 订阅中心
          </Link>
        </p>
        <h1 className="text-2xl md:text-3xl font-bold">AI 工具订阅</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          勾选工具并完成模拟订阅后，权益将合并进 SSO 工具分组（须仍满足黄金会员与余额规则）。
          单品需后台配置 <span className="font-mono text-xs">toolNavKey</span>。
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {catalog.length === 0 ? (
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
                {catalog.map((p) => {
                  const sub = subByProductId.get(p.id);
                  const navLabel = p.toolNavKey
                    ? TOOL_NAV_LABEL[p.toolNavKey] ?? p.toolNavKey
                    : null;
                  const canSubscribe = Boolean(p.toolNavKey?.trim()) && !p.catalogUnavailable;
                  return (
                    <tr key={p.id} className="border-b border-secondary/60 align-top">
                      <td className="py-3 pr-4">
                        <span className="font-medium text-foreground block">{p.title}</span>
                        <span className="text-xs text-muted-foreground block mt-0.5 leading-snug">
                          {p.toolNavKey ? (
                            <>
                              分组：<span className="font-mono">{p.toolNavKey}</span>
                              {navLabel ? ` · ${navLabel}` : null}
                            </>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              后台未配置 toolNavKey，暂不可单品订阅。
                            </span>
                          )}
                          {p.catalogUnavailable ? (
                            <span className="block text-amber-600 dark:text-amber-400 mt-1">
                              前台已暂停新订。
                            </span>
                          ) : null}
                        </span>
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
    </main>
  );
}
