import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatPointsAsYuan } from "@/lib/currency";
import { toolKeyToLabel } from "@/lib/tool-key-label";
import {
  balanceRiskLevel,
  balanceRiskThresholdPoints,
} from "@/lib/balance-risk";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatToolUsageChargeDisplay,
  formatToolUsageUnitPriceDisplay,
  isAiFitBillableTryOn,
} from "@/lib/tool-usage-charge-display";

export const metadata = {
  title: "工具使用明细与费用 — 管理后台",
};

const PAGE_SIZE = 50;

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

function qp(sp: Props["searchParams"], key: string): string {
  const v = sp?.[key];
  return typeof v === "string" ? v : Array.isArray(v) ? (v[0] ?? "") : "";
}

function buildListHref(opts: {
  page: number;
  user: string;
  balanceRisk: string;
}): string {
  const p = new URLSearchParams();
  p.set("page", String(opts.page));
  const u = opts.user.trim();
  if (u) p.set("user", u);
  if (opts.balanceRisk && opts.balanceRisk !== "all") {
    p.set("balanceRisk", opts.balanceRisk);
  }
  const q = p.toString();
  return q.length > 0 ? `/admin/tool-usage?${q}` : "/admin/tool-usage";
}

function RiskBadge({
  level,
}: {
  level: ReturnType<typeof balanceRiskLevel>;
}) {
  if (level === "ok") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const cls =
    level === "critical"
      ? "bg-destructive/15 text-destructive border border-destructive/25"
      : level === "warn_mid"
        ? "bg-orange-500/15 text-orange-800 border border-orange-500/25 dark:text-orange-200"
        : "bg-amber-500/15 text-amber-900 border border-amber-600/25 dark:text-amber-100";
  const label =
    level === "critical"
      ? "低于最低线"
      : level === "warn_mid"
        ? "低于中等预警"
        : "低于较高预警";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${cls}`}>
      {label}
    </span>
  );
}

export default async function AdminToolUsagePage({ searchParams }: Props) {
  const platform =
    (await prisma.platformConfig.findUnique({ where: { id: "default" } })) ??
    null;

  const pageRaw = parseInt(qp(searchParams, "page"), 10);
  const page = Math.max(1, Number.isFinite(pageRaw) ? pageRaw : 1);
  const userQuery = qp(searchParams, "user").trim();
  const balanceRisk = qp(searchParams, "balanceRisk") || "all";

  const userAnd: Prisma.UserWhereInput[] = [];

  if (userQuery.length > 0) {
    const or: Prisma.UserWhereInput[] = [
      { email: { contains: userQuery, mode: "insensitive" } },
      { name: { contains: userQuery, mode: "insensitive" } },
    ];
    if (/^[a-z0-9]{20,}$/i.test(userQuery)) {
      or.push({ id: userQuery });
    }
    userAnd.push({ OR: or });
  }

  if (platform && balanceRisk !== "all") {
    const thr = balanceRiskThresholdPoints(balanceRisk, platform);
    if (thr != null) {
      userAnd.push({
        OR: [
          { wallet: { is: null } },
          { wallet: { balancePoints: { lt: thr } } },
        ],
      });
    }
  }

  const where: Prisma.ToolUsageEventWhereInput =
    userAnd.length > 0 ? { user: { AND: userAnd } } : {};

  const skip = (page - 1) * PAGE_SIZE;

  const [total, events] = await prisma.$transaction([
    prisma.toolUsageEvent.count({ where }),
    prisma.toolUsageEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        toolKey: true,
        action: true,
        costPoints: true,
        meta: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            wallet: { select: { balancePoints: true } },
          },
        },
      },
    }),
  ]);

  const usersBelowMinCount =
    platform != null
      ? await prisma.user.count({
          where: {
            OR: [
              { wallet: { is: null } },
              {
                wallet: {
                  balancePoints: { lt: platform.minBalanceLinePoints },
                },
              },
            ],
          },
        })
      : 0;

  const aiFitBillWhere: Prisma.ToolUsageEventWhereInput = {
    ...where,
    toolKey: "fitting-room__ai-fit",
    action: "try_on",
  };

  const [aiFitAgg, aiFitMissingCostCount] = await Promise.all([
    prisma.toolUsageEvent.aggregate({
      where: aiFitBillWhere,
      _sum: { costPoints: true },
      _count: true,
    }),
    prisma.toolUsageEvent.count({
      where: {
        ...aiFitBillWhere,
        costPoints: null,
      },
    }),
  ]);

  const aiFitSumPoints = aiFitAgg._sum.costPoints ?? 0;
  const aiFitTryOnCount = aiFitAgg._count;

  const totalPages = total === 0 ? 0 : Math.ceil(total / PAGE_SIZE);
  const pageSumPoints = events.reduce((acc: number, e) => {
    const c = e.costPoints;
    return acc + (typeof c === "number" && c > 0 ? c : 0);
  }, 0);

  const warnRowsOnPage = events.filter((e) => {
    if (!platform) return false;
    const bal = e.user.wallet?.balancePoints ?? 0;
    return balanceRiskLevel(bal, platform) === "critical";
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">工具使用明细与费用</h1>
        <p className="text-sm text-muted-foreground">
          逐条展示打点与扣费。库里为{" "}
          <code className="rounded bg-muted px-1 text-xs">costPoints（点）</code>，100 点 = 1 元，与「工具管理 →
          按次单价」同一记账口径。
          <strong className="font-medium text-foreground"> AI智能试衣</strong>仅在成片成功后的{" "}
          <code className="rounded bg-muted px-1 text-xs">try_on</code>{" "}
          事件计价；浏览与非计费入口扣费列显示「不计费」。默认每页 {PAGE_SIZE} 条。
        </p>
      </div>

      <div className="rounded-lg border border-secondary bg-muted/30 px-4 py-3 text-sm">
        <strong className="text-foreground">AI智能试衣计费汇总（当前筛选）</strong>
        <span className="mx-2 text-muted-foreground">·</span>
        <span className="text-muted-foreground">
          成功试衣事件（try_on）共{" "}
          <strong className="tabular-nums text-foreground">{aiFitTryOnCount}</strong> 条
          ，合计扣点{" "}
          <strong className="tabular-nums text-foreground">
            {aiFitSumPoints > 0
              ? `${aiFitSumPoints.toLocaleString("zh-CN")} 点（约合 ¥${formatPointsAsYuan(aiFitSumPoints)}）`
              : "—"}
          </strong>
          {aiFitMissingCostCount > 0 ? (
            <>
              <span className="mx-2 text-muted-foreground">·</span>
              <span className="text-amber-800 dark:text-amber-200">
                其中 <strong>{aiFitMissingCostCount}</strong> 条未写 costPoints（异常）
              </span>
            </>
          ) : null}
        </span>
      </div>

      {platform && usersBelowMinCount > 0 ? (
        <div
          className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          <strong className="text-destructive">余额预警：</strong>
          全站共有 <strong>{usersBelowMinCount}</strong>{" "}
          名用户钱包余额<strong>低于最低可用线</strong>（
          {platform.minBalanceLinePoints.toLocaleString("zh-CN")} 点 / ¥
          {formatPointsAsYuan(platform.minBalanceLinePoints)}，工具黄金会员准入参考）。可在下方筛选「低于最低可用线」聚焦相关流水。
        </div>
      ) : null}

      {warnRowsOnPage > 0 ? (
        <p className="text-xs text-muted-foreground">
          本页内 <strong>{warnRowsOnPage}</strong>{" "}
          条记录所属用户余额已低于最低线（行内「预警」列标红档）。
        </p>
      ) : null}

      <form
        method="GET"
        action="/admin/tool-usage"
        className="flex flex-wrap items-end gap-4 rounded-lg border border-secondary bg-card/40 p-4"
      >
        <input type="hidden" name="page" value="1" />
        <div className="grid gap-2">
          <Label htmlFor="filter-user">用户筛选</Label>
          <Input
            id="filter-user"
            name="user"
            placeholder="邮箱 / 昵称 / 用户 ID"
            defaultValue={userQuery}
            className="min-w-[14rem]"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="filter-risk">余额筛选</Label>
          <select
            id="filter-risk"
            name="balanceRisk"
            defaultValue={balanceRisk}
            className="flex h-10 min-w-[14rem] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">全部</option>
            <option value="below_high">低于较高预警线</option>
            <option value="below_mid">低于中等预警线</option>
            <option value="below_min">低于最低可用线</option>
          </select>
        </div>
        <Button type="submit">应用筛选</Button>
        <Button variant="outline" type="button" asChild>
          <Link href="/admin/tool-usage">重置</Link>
        </Button>
      </form>

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
          )}{" "}
          · 本页合计扣点{" "}
          <strong className="text-foreground tabular-nums">
            {pageSumPoints > 0
              ? `${pageSumPoints.toLocaleString("zh-CN")} 点（¥${formatPointsAsYuan(pageSumPoints)}）`
              : "—"}
          </strong>
        </span>
        <div className="flex gap-2">
          {page <= 1 || total === 0 ? (
            <Button variant="outline" size="sm" disabled>
              上一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildListHref({
                  page: page - 1,
                  user: userQuery,
                  balanceRisk,
                })}
              >
                上一页
              </Link>
            </Button>
          )}
          {total === 0 || page >= totalPages ? (
            <Button variant="outline" size="sm" disabled>
              下一页
            </Button>
          ) : (
            <Button variant="outline" size="sm" asChild>
              <Link
                href={buildListHref({
                  page: page + 1,
                  user: userQuery,
                  balanceRisk,
                })}
              >
                下一页
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">预警</th>
              <th className="p-3 font-medium">用户</th>
              <th className="p-3 font-medium text-right">余额（点）</th>
              <th className="p-3 font-medium">工具</th>
              <th className="p-3 font-medium">动作</th>
              <th className="p-3 font-medium text-right">按次扣点</th>
              <th className="p-3 font-medium text-right">本笔扣点</th>
              <th className="p-3 font-medium">时间</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={8}>
                  {total === 0 ? "暂无打点数据。" : "当前页无数据（请调整筛选）。"}
                </td>
              </tr>
            ) : (
              events.map((row) => {
                const u = row.user;
                const primary = u.email ?? u.id;
                const secondary = u.name?.trim() ? u.name : "—";
                const bal = u.wallet?.balancePoints ?? 0;
                const level =
                  platform != null ? balanceRiskLevel(bal, platform) : "ok";
                const charge = formatToolUsageChargeDisplay(
                  row.toolKey,
                  row.action,
                  row.costPoints,
                );
                const unit = formatToolUsageUnitPriceDisplay(
                  row.toolKey,
                  row.action,
                  row.costPoints,
                  row.meta,
                );

                return (
                  <tr
                    key={row.id}
                    className="border-b border-secondary/80 align-top last:border-0"
                  >
                    <td className="p-3 whitespace-nowrap">
                      <RiskBadge level={level} />
                    </td>
                    <td className="p-3">
                      <div className="max-w-[14rem] truncate font-medium" title={primary}>
                        {primary}
                      </div>
                      <div className="text-xs text-muted-foreground">{secondary}</div>
                    </td>
                    <td className="p-3 text-right align-top">
                      <div className="tabular-nums font-medium text-foreground">
                        {bal.toLocaleString("zh-CN")} 点
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        约合 ¥{formatPointsAsYuan(bal)}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{toolKeyToLabel(row.toolKey)}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {row.toolKey}
                      </div>
                    </td>
                    <td className="p-3">{row.action}</td>
                    <td
                      className={cn(
                        "p-3 text-right align-top tabular-nums",
                        unit.variant === "priced" && "font-medium text-foreground",
                        unit.variant === "nonbill" && "text-muted-foreground",
                        unit.variant === "dash" &&
                          isAiFitBillableTryOn(row.toolKey, row.action) &&
                          "text-amber-800 dark:text-amber-200",
                      )}
                    >
                      <div>{unit.primary}</div>
                      {unit.secondary ? (
                        <div className="text-xs text-muted-foreground font-normal">{unit.secondary}</div>
                      ) : null}
                    </td>
                    <td
                      className={cn(
                        "p-3 text-right align-top tabular-nums",
                        charge.variant === "priced" && "font-medium text-foreground",
                        charge.variant === "nonbill" && "text-muted-foreground",
                        charge.variant === "dash" &&
                          isAiFitBillableTryOn(row.toolKey, row.action) &&
                          "text-amber-800 dark:text-amber-200",
                      )}
                    >
                      <div>{charge.primary}</div>
                      {charge.secondary ? (
                        <div className="text-xs text-muted-foreground font-normal">{charge.secondary}</div>
                      ) : null}
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {row.createdAt.toLocaleString("zh-CN")}
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
