#!/usr/bin/env tsx
/**
 * 列出画布视频任务在交通控流排队中、尚未产生 Gateway 日志的记录（运维对账）。
 *
 * 用法：
 *   pnpm --dir book-mall canvas:queued-reconcile
 *   pnpm --dir book-mall canvas:queued-reconcile -- --stale-min=5 --limit=100
 *
 * 等价 SQL（PostgreSQL，stale_min=2）：
 *   SELECT t.id, t.status, t."projectId", t."nodeId", t.model,
 *          t."queuedAt", t."createdAt", t."dispatchAfter"
 *   FROM "CanvasGenerationTask" t
 *   WHERE t.status IN ('QUEUED', 'DISPATCHING')
 *     AND (t."inputPayload"->>'kind') IN ('video-engine', 'ai-video-engine')
 *     AND COALESCE(t."queuedAt", t."createdAt") <= NOW() - INTERVAL '2 minutes'
 *   ORDER BY COALESCE(t."queuedAt", t."createdAt") ASC
 *   LIMIT 50;
 */
import {
  fetchCanvasQueueWithoutLogStats,
  listCanvasQueuedWithoutLogTasks,
} from "@/lib/canvas/canvas-queue-without-log";

function readArg(name: string, fallback: string): string {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1]!;
  return fallback;
}

async function main() {
  const staleMin = Math.max(0, Number(readArg("--stale-min", "2")) || 2);
  const limit = Math.max(1, Number(readArg("--limit", "50")) || 50);
  const all = readArg("--all", "") === "1" || process.argv.includes("--all");

  const stats = await fetchCanvasQueueWithoutLogStats({
    ownerUserIds: all ? null : null,
    staleMinutes: staleMin,
  });

  const tasks = await listCanvasQueuedWithoutLogTasks({
    ownerUserIds: null,
    staleMinutes: staleMin > 0 ? staleMin : undefined,
    limit,
  });

  console.log("=== Canvas 排队（尚无 Gateway log）===");
  console.log(
    JSON.stringify(
      {
        ...stats,
        hint:
          "QUEUED/DISPATCHING 在 createTask 成功前不会产生 GatewayRequestLog；画布 UI 仍显示「排队中/生成中」。",
      },
      null,
      2,
    ),
  );

  if (tasks.length === 0) {
    console.log(
      staleMin > 0
        ? `\n无排队超过 ${staleMin} 分钟的任务。`
        : "\n当前无 QUEUED/DISPATCHING 画布视频任务。",
    );
    return;
  }

  console.log(`\n明细（${tasks.length} 条，stale≥${staleMin}min）：`);
  console.table(
    tasks.map((t) => ({
      id: t.id.slice(0, 8),
      status: t.status,
      waitMin: t.waitMinutes,
      project: t.projectName,
      nodeId: t.nodeId.slice(0, 8),
      model: t.model,
      dispatchAfter: t.dispatchAfter?.slice(11, 19) ?? "-",
    })),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
