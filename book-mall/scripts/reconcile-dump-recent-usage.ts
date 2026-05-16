/**
 * 一次性：按 UTC 日窗口拉取 ToolUsageEvent（有扣点），供与云 CSV 人工对照。
 * ./node_modules/.bin/dotenv -e .env.local -- ./node_modules/.bin/tsx scripts/reconcile-dump-recent-usage.ts
 *
 * 默认窗口：2026-05-15 00:00 UTC .. 2026-05-16 00:00 UTC（与 export 20260516 可对「昨天」）。
 */
import { prisma } from "../lib/prisma";

const start = new Date(process.env.RECON_START ?? "2026-05-15T00:00:00.000Z");
const end = new Date(process.env.RECON_END ?? "2026-05-16T00:00:00.000Z");

async function main() {
  const ev = await prisma.toolUsageEvent.findMany({
    where: {
      createdAt: { gte: start, lt: end },
      costPoints: { not: null, gt: 0 },
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      createdAt: true,
      toolKey: true,
      action: true,
      costPoints: true,
      meta: true,
      userId: true,
    },
  });

  console.log(
    JSON.stringify(
      { window: { start: start.toISOString(), end: end.toISOString() }, count: ev.length, events: ev },
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
