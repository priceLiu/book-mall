import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "工具使用记录",
};

export default async function AdminToolUsagePage() {
  const events = await prisma.toolUsageEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      user: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  const sumMinor = events.reduce(
    (acc, e) => acc + (typeof e.costMinor === "number" ? e.costMinor : 0),
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">工具使用记录</h1>
        <p className="text-sm text-muted-foreground">
          最近 500 条打点 · 来自工具站 JWT 写入 · 本页展示合计消耗{" "}
          <strong>{(sumMinor / 100).toFixed(2)}</strong> 元（仅含已填 costMinor 的事件）
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-secondary">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b border-secondary bg-muted/50">
            <tr>
              <th className="p-3 font-medium">时间</th>
              <th className="p-3 font-medium">用户</th>
              <th className="p-3 font-medium">工具键</th>
              <th className="p-3 font-medium">动作</th>
              <th className="p-3 font-medium">消耗(元)</th>
              <th className="p-3 font-medium">详情 meta</th>
            </tr>
          </thead>
          <tbody>
            {events.map((row) => (
              <tr
                key={row.id}
                className="border-b border-secondary/80 align-top last:border-0"
              >
                <td className="whitespace-nowrap p-3 text-muted-foreground">
                  {row.createdAt.toLocaleString("zh-CN")}
                </td>
                <td className="p-3">
                  <div className="max-w-[14rem] truncate" title={row.user.email ?? row.user.id}>
                    {row.user.email ?? row.user.id}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {row.user.name ?? "—"}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{row.toolKey}</td>
                <td className="p-3">{row.action}</td>
                <td className="p-3 tabular-nums">
                  {typeof row.costMinor === "number" && row.costMinor > 0
                    ? (row.costMinor / 100).toFixed(2)
                    : "—"}
                </td>
                <td className="max-w-md break-all p-3 font-mono text-xs text-muted-foreground">
                  {row.meta == null
                    ? "—"
                    : JSON.stringify(row.meta).length > 200
                      ? `${JSON.stringify(row.meta).slice(0, 200)}…`
                      : JSON.stringify(row.meta)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
