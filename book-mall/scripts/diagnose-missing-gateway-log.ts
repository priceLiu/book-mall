#!/usr/bin/env tsx
/** 诊断：进行中 >N 分钟但尚无 / 已有 Gateway 日志 */
import { prisma } from "@/lib/prisma";
import { listCanvasQueuedWithoutLogTasks } from "@/lib/canvas/canvas-queue-without-log";
import { isGatewayVideoLogOccupyingTrafficSlot } from "@/lib/gateway/video-background-generation";

const waitMin = Math.max(1, Number(process.argv[2] ?? "10") || 10);

async function main() {
  const cutoff = new Date(Date.now() - waitMin * 60_000);

  const queued = await listCanvasQueuedWithoutLogTasks({
    staleMinutes: waitMin,
    limit: 100,
  });
  console.log(`\n=== Canvas QUEUED/DISPATCHING ≥${waitMin}min，尚无 Gateway log：${queued.length} ===`);
  if (queued.length) {
    console.table(
      queued.map((t) => ({
        id: t.id.slice(0, 12),
        status: t.status,
        waitMin: t.waitMinutes,
        project: t.projectName.slice(0, 24),
        dispatchAfter: t.dispatchAfter?.slice(11, 19) ?? "-",
      })),
    );
  }

  const inflight = await prisma.canvasGenerationTask.findMany({
    where: {
      status: { in: ["PENDING", "SUBMITTED"] },
      createdAt: { lte: cutoff },
    },
    select: {
      id: true,
      status: true,
      pollCount: true,
      failCode: true,
      submittedAt: true,
      createdAt: true,
      inputPayload: true,
    },
    take: 50,
  });
  const missingGw = inflight.filter((t) => {
    const p =
      t.inputPayload && typeof t.inputPayload === "object"
        ? (t.inputPayload as Record<string, unknown>)
        : null;
    return !p?.gatewayLogId;
  });
  console.log(
    `\n=== Canvas PENDING/SUBMITTED ≥${waitMin}min 且无 gatewayLogId：${missingGw.length} ===`,
  );
  for (const t of missingGw) {
    const p = t.inputPayload as Record<string, unknown>;
    const anchor = t.submittedAt ?? t.createdAt;
    console.log({
      id: t.id,
      status: t.status,
      waitMin: Math.round((Date.now() - anchor.getTime()) / 60_000),
      kind: p?.kind,
      pollCount: t.pollCount,
      failCode: t.failCode,
    });
  }

  const gwLogs = await prisma.gatewayRequestLog.findMany({
    where: {
      status: { in: ["PENDING", "RUNNING"] },
      requestKind: "VIDEO",
      submittedAt: { lte: cutoff },
    },
    select: {
      id: true,
      status: true,
      model: true,
      submittedAt: true,
      clientSource: true,
      resultSummary: true,
    },
    orderBy: { submittedAt: "asc" },
    take: 30,
  });
  console.log(
    `\n=== Gateway 视频 in-flight ≥${waitMin}min（应出现在日志/后台等待）：${gwLogs.length} ===`,
  );
  console.table(
    gwLogs.map((l) => ({
      id: l.id.slice(0, 12),
      status: l.status,
      waitMin: Math.round((Date.now() - l.submittedAt.getTime()) / 60_000),
      model: l.model?.slice(0, 28),
      slot: isGatewayVideoLogOccupyingTrafficSlot({
        status: l.status,
        requestKind: "VIDEO",
        resultSummary: l.resultSummary,
      })
        ? "占槽"
        : "已释槽",
      source: l.clientSource,
    })),
  );

  const states = await prisma.generationTrafficState.findMany({
    orderBy: { runningVideoCount: "desc" },
    take: 15,
  });
  console.log("\n=== 交通控流状态（runningVideoCount / maxConcurrency）===");
  console.table(
    states.map((s) => ({
      scope: s.scopeKey.slice(0, 36),
      running: s.runningVideoCount,
      max: s.maxConcurrency,
      tokens: Math.round(s.dispatchTokens * 10) / 10,
    })),
  );

  const dispatching = await prisma.canvasGenerationTask.findMany({
    where: { status: "DISPATCHING" },
    select: {
      id: true,
      updatedAt: true,
      queuedAt: true,
      createdAt: true,
      kieTaskId: true,
      failCode: true,
      inputPayload: true,
      project: { select: { name: true } },
    },
  });
  if (dispatching.length) {
    console.log(`\n=== DISPATCHING 明细（createTask 未完成 → 无 Gateway log）：${dispatching.length} ===`);
    console.table(
      dispatching.map((t) => {
        const p =
          t.inputPayload && typeof t.inputPayload === "object"
            ? (t.inputPayload as Record<string, unknown>)
            : null;
        const anchor = t.queuedAt ?? t.createdAt;
        return {
          id: t.id.slice(0, 14),
          waitMin: Math.round((Date.now() - anchor.getTime()) / 60_000),
          staleSec: Math.round((Date.now() - t.updatedAt.getTime()) / 1000),
          queuedAt: t.queuedAt?.toISOString()?.slice(11, 19) ?? "null",
          gw: p?.gatewayLogId ? String(p.gatewayLogId).slice(0, 12) : null,
          claimed: p?.gatewayKieSubmitClaimed,
          kieTaskId: t.kieTaskId?.slice(0, 12) ?? null,
          project: t.project.name.slice(0, 20),
        };
      }),
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
