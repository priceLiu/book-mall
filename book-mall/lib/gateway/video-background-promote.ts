/**
 * 画布异步视频 · ≥15min 转入持续后台生成（释放交通槽，保持 RUNNING + 继续 poll）。
 * 覆盖火山 / DashScope / 百炼 R2V / KIE / MiniMax 等 Gateway VIDEO 任务。
 */
import type { Prisma } from "@prisma/client";

import {
  attachVideoBackgroundGeneration,
  readVideoBackgroundGeneration,
} from "@/lib/gateway/video-background-generation";
import { VIDEO_BACKGROUND_UI_MS } from "@/lib/gateway/video-task-wait-policy";
import { prisma } from "@/lib/prisma";

const ASYNC_VIDEO_PROVIDER_KINDS = [
  "VOLCENGINE",
  "DASHSCOPE",
  "BAILIAN",
  "KIE",
  "MINIMAX",
] as const;

export async function promoteVideoTasksToBackgroundGeneration(
  nowMs: number = Date.now(),
): Promise<number> {
  const submittedCutoff = new Date(nowMs - VIDEO_BACKGROUND_UI_MS);

  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: submittedCutoff },
      providerKind: { in: [...ASYNC_VIDEO_PROVIDER_KINDS] },
    },
    select: {
      id: true,
      providerKind: true,
      submittedAt: true,
      resultSummary: true,
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });

  let promoted = 0;
  for (const row of rows) {
    const existingBg = readVideoBackgroundGeneration(row.resultSummary);
    if (existingBg?.slotReleased) continue;

    const ageMs = nowMs - row.submittedAt.getTime();
    if (ageMs < VIDEO_BACKGROUND_UI_MS) continue;

    let nextSummary: Record<string, unknown> =
      row.resultSummary && typeof row.resultSummary === "object" && !Array.isArray(row.resultSummary)
        ? { ...(row.resultSummary as Record<string, unknown>) }
        : {};

    if (row.providerKind === "VOLCENGINE") {
      const {
        isVolcengineVendorStuck,
        readVolcengineTimingTrace,
        computeVolcengineTimingBreakdown,
        attachGatewayTimingToSummary,
      } = await import("@/lib/gateway/log-volcengine-timing");
      const trace = readVolcengineTimingTrace(row.resultSummary);
      if (trace) {
        const breakdown = computeVolcengineTimingBreakdown({
          trace,
          submittedAtMs: row.submittedAt.getTime(),
          completedAtMs: null,
          nowMs,
        });
        nextSummary = attachGatewayTimingToSummary(nextSummary, trace, breakdown);
        const vendorStuck = isVolcengineVendorStuck(trace, nowMs, VIDEO_BACKGROUND_UI_MS);
        if (!vendorStuck && ageMs < VIDEO_BACKGROUND_UI_MS) continue;
      }
    }

    nextSummary = attachVideoBackgroundGeneration(nextSummary, {
      sinceMs: existingBg?.sinceMs ?? row.submittedAt.getTime() + VIDEO_BACKGROUND_UI_MS,
      slotReleased: true,
      promotedAtMs: nowMs,
    });

    const { releaseGatewayVideoTrafficSlotIfOccupying } = await import(
      "@/lib/generation/traffic-control/release-gateway-video-traffic-slot"
    );
    await releaseGatewayVideoTrafficSlotIfOccupying({
      logId: row.id,
      fireDispatch: true,
      nowMs,
    });

    await prisma.gatewayRequestLog.updateMany({
      where: {
        id: row.id,
        status: "RUNNING",
      },
      data: {
        resultSummary: nextSummary as Prisma.InputJsonValue,
      },
    });

    promoted++;
  }

  return promoted;
}
