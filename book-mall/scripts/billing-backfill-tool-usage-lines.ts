/**
 * 回填：把历史 `ToolUsageEvent`（`costPoints > 0`）补成对应的 `ToolBillingDetailLine`
 * （source = TOOL_USAGE_GENERATED, pricingTemplateKey = internal.tool_usage_v1）。
 *
 * 等价于把 0516 重构「工具上报成功时同事务生成 1~N 条 ToolBillingDetailLine」补回到历史数据上。
 *
 * 用法：
 *   pnpm billing:backfill-tool-usage-lines
 *   BILLING_BACKFILL_USER_ID=<User.id> pnpm billing:backfill-tool-usage-lines
 *
 * 安全性：
 * - 已存在「同 toolUsageEventId」的明细会跳过；幂等可重复执行。
 * - 仅 `costPoints > 0` 的事件会被回填（page_view 等不计费事件忽略）。
 */
import { prisma } from "../lib/prisma";
import { buildToolUsageBillingLineData } from "../lib/finance/tool-usage-billing-line";

const BATCH = 200;

async function main() {
  const userIdFilter = process.env.BILLING_BACKFILL_USER_ID?.trim() || undefined;

  let scanned = 0;
  let inserted = 0;
  let skippedExisting = 0;
  let cursor: string | null = null;

  for (;;) {
    const events: Array<{
      id: string;
      userId: string;
      toolKey: string;
      action: string;
      costPoints: number | null;
      meta: unknown;
      createdAt: Date;
    }> = await prisma.toolUsageEvent.findMany({
      where: {
        costPoints: { gt: 0 },
        ...(userIdFilter ? { userId: userIdFilter } : {}),
      },
      orderBy: { id: "asc" },
      take: BATCH,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        userId: true,
        toolKey: true,
        action: true,
        costPoints: true,
        meta: true,
        createdAt: true,
      },
    });

    if (events.length === 0) break;
    scanned += events.length;

    const ids = events.map((e) => e.id);
    const existing = await prisma.toolBillingDetailLine.findMany({
      where: { toolUsageEventId: { in: ids } },
      select: { toolUsageEventId: true },
    });
    const existingSet = new Set(existing.map((e) => e.toolUsageEventId).filter((v): v is string => !!v));

    const dataList = events
      .filter((e) => !existingSet.has(e.id))
      .map((e) =>
        buildToolUsageBillingLineData({
          userId: e.userId,
          toolKey: e.toolKey,
          action: e.action,
          costPoints: e.costPoints ?? 0,
          meta: e.meta,
          usageEventId: e.id,
          createdAt: e.createdAt,
        }),
      );

    skippedExisting += events.length - dataList.length;

    if (dataList.length > 0) {
      const res = await prisma.toolBillingDetailLine.createMany({ data: dataList });
      inserted += res.count;
    }

    cursor = events[events.length - 1]?.id ?? null;
    if (events.length < BATCH) break;
  }

  console.log(
    JSON.stringify(
      {
        where: userIdFilter ?? "all-users",
        scanned,
        inserted,
        skippedExisting,
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
