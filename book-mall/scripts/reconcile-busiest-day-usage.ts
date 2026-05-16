/**
 * 按 UTC 日聚合 costPoints>0 的 ToolUsageEvent，找出「用量」最大日（条数+点数）。
 * ./node_modules/.bin/dotenv -e .env.local -- ./node_modules/.bin/tsx scripts/reconcile-busiest-day-usage.ts
 */
import { prisma } from "../lib/prisma";

async function main() {
  const ev = await prisma.toolUsageEvent.findMany({
    where: { costPoints: { gt: 0 } },
    select: { createdAt: true, costPoints: true, toolKey: true, action: true, id: true },
  });

  const byUtcDay = new Map<string, { count: number; points: number }>();
  for (const e of ev) {
    const d = e.createdAt.toISOString().slice(0, 10);
    const x = byUtcDay.get(d) ?? { count: 0, points: 0 };
    x.count += 1;
    x.points += e.costPoints ?? 0;
    byUtcDay.set(d, x);
  }

  let bestUtc: string | null = null;
  let bestScore = -1;
  for (const [d, v] of byUtcDay) {
    const score = v.count * 1e9 + v.points;
    if (score > bestScore) {
      bestScore = score;
      bestUtc = d;
    }
  }

  const byChinaDay = new Map<string, { count: number; points: number }>();
  for (const e of ev) {
    const china = new Date(e.createdAt.getTime() + 8 * 60 * 60 * 1000);
    const d = china.toISOString().slice(0, 10);
    const x = byChinaDay.get(d) ?? { count: 0, points: 0 };
    x.count += 1;
    x.points += e.costPoints ?? 0;
    byChinaDay.set(d, x);
  }

  let bestCn: string | null = null;
  let bestCnScore = -1;
  for (const [d, v] of byChinaDay) {
    const score = v.count * 1e9 + v.points;
    if (score > bestCnScore) {
      bestCnScore = score;
      bestCn = d;
    }
  }

  console.log(
    JSON.stringify(
      {
        totalEvents: ev.length,
        busiestUtcDay: bestUtc,
        busiestUtcStats: bestUtc ? byUtcDay.get(bestUtc) : null,
        busiestChinaDay: bestCn,
        busiestChinaStats: bestCn ? byChinaDay.get(bestCn) : null,
        top5ChinaDays: [...byChinaDay.entries()]
          .sort((a, b) => b[1].count - a[1].count || b[1].points - a[1].points)
          .slice(0, 5)
          .map(([d, v]) => ({ date: d, ...v })),
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
