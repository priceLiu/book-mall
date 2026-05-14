import Link from "next/link";
import { WalletEntryType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "充值明细 — 管理后台",
};

const PAGE_SIZE = 40;

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function qp(sp: Props["searchParams"], key: string): string {
  const v = sp?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
}

export default async function AdminRechargesPage({ searchParams }: Props) {
  const pageRaw = parseInt(qp(searchParams, "page"), 10);
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where = { type: WalletEntryType.RECHARGE };

  const [total, rows, sumAgg] = await prisma.$transaction([
    prisma.walletEntry.count({ where }),
    prisma.walletEntry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        amountPoints: true,
        balanceAfterPoints: true,
        description: true,
        orderId: true,
        createdAt: true,
        wallet: {
          select: {
            user: {
              select: { id: true, email: true, name: true },
            },
          },
        },
      },
    }),
    prisma.walletEntry.aggregate({
      where,
      _sum: { amountPoints: true },
    }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const sumPoints = sumAgg._sum.amountPoints ?? 0;

  const buildHref = (p: number) =>
    p <= 1 ? "/admin/finance/recharges" : `/admin/finance/recharges?page=${p}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">充值明细</h1>
          <p className="text-sm text-muted-foreground">
          历史「钱包入账 · 充值」流水；累计充值入账{" "}
          <strong className="text-foreground tabular-nums">
            {sumPoints.toLocaleString("zh-CN")} 点
          </strong>
          （¥{formatPointsAsYuan(sumPoints)}）。
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/admin">← 返回概览</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          共 <strong className="text-foreground">{total}</strong> 条 ·{" "}
          {total === 0 ? (
            <span>无分页</span>
          ) : (
            <>
              第 <strong className="text-foreground">{page}</strong> /{" "}
              <strong className="text-foreground">{totalPages}</strong> 页
            </>
          )}
        </span>
        <div className="flex gap-2">
          {page <= 1 || total === 0 ? (
            <Button variant="outline" size="sm" disabled>
              上一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildHref(page - 1)}>上一页</Link>
            </Button>
          )}
          {total === 0 || page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              下一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link href={buildHref(page + 1)}>下一页</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">时间</th>
              <th className="p-3 font-medium">用户</th>
              <th className="p-3 font-medium text-right">入账（点）</th>
              <th className="p-3 font-medium text-right">入账后余额（点）</th>
              <th className="p-3 font-medium">备注 / 订单</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  暂无充值记录。
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const user = r.wallet.user;
                const primary = user.email ?? user.id;
                const secondary = user.name?.trim() ? user.name : "—";
                const desc = [r.description, r.orderId ? `#${r.orderId}` : ""]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <tr
                    key={r.id}
                    className="border-b border-secondary/80 align-top last:border-0"
                  >
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {r.createdAt.toLocaleString("zh-CN")}
                    </td>
                    <td className="p-3">
                      <div className="max-w-[14rem] truncate font-medium" title={primary}>
                        {primary}
                      </div>
                      <div className="text-xs text-muted-foreground">{secondary}</div>
                    </td>
                    <td className="p-3 tabular-nums text-right font-medium text-emerald-700 dark:text-emerald-400">
                      +{r.amountPoints.toLocaleString("zh-CN")} 点
                      <span className="block text-xs font-normal text-muted-foreground">
                        ¥{formatPointsAsYuan(r.amountPoints)}
                      </span>
                    </td>
                    <td className="p-3 tabular-nums text-right">
                      {r.balanceAfterPoints.toLocaleString("zh-CN")} 点
                      <span className="block text-xs text-muted-foreground">
                        ¥{formatPointsAsYuan(r.balanceAfterPoints)}
                      </span>
                    </td>
                    <td className="p-3 max-w-[20rem] truncate text-muted-foreground" title={desc}>
                      {desc || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
