import { prisma } from "@/lib/prisma";
import { toolKeyToLabel } from "@/lib/tool-key-label";

export const metadata = {
  title: "工具使用记录",
};

const MAX_GROUPS = 500;

type GroupRow = {
  userId: string;
  toolKey: string;
  count: number;
  sumCostMinor: number;
  lastAt: Date;
};

export default async function AdminToolUsagePage() {
  const groups = await prisma.toolUsageEvent.groupBy({
    by: ["userId", "toolKey"],
    _count: { _all: true },
    _sum: { costMinor: true },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: "desc" } },
    take: MAX_GROUPS,
  });

  const rows: GroupRow[] = groups.map((g) => ({
    userId: g.userId,
    toolKey: g.toolKey,
    count: g._count?._all ?? 0,
    sumCostMinor: g._sum?.costMinor ?? 0,
    lastAt: g._max?.createdAt ?? new Date(0),
  }));

  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true, name: true },
        });
  const userById = new Map(users.map((u) => [u.id, u] as const));

  const totalCost = rows.reduce((acc, r) => acc + r.sumCostMinor, 0);
  const totalCalls = rows.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">工具使用记录</h1>
        <p className="text-sm text-muted-foreground">
          按「用户 × 工具」聚合 · 最多展示 {MAX_GROUPS} 组 · 总调用 <strong>{totalCalls}</strong> 次 · 合计消耗{" "}
          <strong>{(totalCost / 100).toFixed(2)}</strong> 元（仅含已填 <code>costMinor</code> 的事件）
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">用户</th>
              <th className="p-3 font-medium">工具</th>
              <th className="p-3 font-medium text-right">使用次数</th>
              <th className="p-3 font-medium text-right">合计消耗(元)</th>
              <th className="p-3 font-medium">最近使用</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="p-3 text-muted-foreground" colSpan={5}>
                  暂无打点数据。
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const u = userById.get(row.userId);
                const primary = u?.email ?? row.userId;
                const secondary = u?.name?.trim() ? u.name : "—";
                return (
                  <tr
                    key={`${row.userId}__${row.toolKey}`}
                    className="border-b border-secondary/80 align-top last:border-0"
                  >
                    <td className="p-3">
                      <div className="max-w-[16rem] truncate" title={primary}>
                        {primary}
                      </div>
                      <div className="text-xs text-muted-foreground">{secondary}</div>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{toolKeyToLabel(row.toolKey)}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {row.toolKey}
                      </div>
                    </td>
                    <td className="p-3 tabular-nums text-right">{row.count}</td>
                    <td className="p-3 tabular-nums text-right">
                      {row.sumCostMinor > 0 ? (row.sumCostMinor / 100).toFixed(2) : "—"}
                    </td>
                    <td className="p-3 whitespace-nowrap text-muted-foreground">
                      {row.lastAt.toLocaleString("zh-CN")}
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
