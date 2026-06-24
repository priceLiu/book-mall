/**
 * 火山视频 · ≥10min 转入持续后台生成（释放交通槽，保持 RUNNING + 继续 poll）。
 * 取代原 expireVolcengineGatewayPollStalledLogs（停更判 FAILED）。
 */
import type { Prisma } from "@prisma/client";

import {
  attachVideoBackgroundGeneration,
  readVideoBackgroundGeneration,
} from "@/lib/gateway/video-background-generation";
import { VIDEO_BACKGROUND_UI_MS } from "@/lib/gateway/video-task-wait-policy";
import { prisma } from "@/lib/prisma";

/** @deprecated 改用 promoteVolcengineTasksToBackgroundGeneration */
export async function expireVolcengineGatewayPollStalledLogs(
  nowMs: number = Date.now(),
): Promise<number> {
  return promoteVolcengineTasksToBackgroundGeneration(nowMs);
}

export async function promoteVolcengineTasksToBackgroundGeneration(
  nowMs: number = Date.now(),
): Promise<number> {
  const {
    isVolcengineVendorStuck,
    readVolcengineTimingTrace,
    computeVolcengineTimingBreakdown,
    attachGatewayTimingToSummary,
  } = await import("@/lib/gateway/log-volcengine-timing");

  const submittedCutoff = new Date(nowMs - VIDEO_BACKGROUND_UI_MS);

  const rows = await prisma.gatewayRequestLog.findMany({
    where: {
      status: "RUNNING",
      providerKind: "VOLCENGINE",
      requestKind: "VIDEO",
      externalTaskId: { not: null },
      submittedAt: { lt: submittedCutoff },
    },
    select: {
      id: true,
      submittedAt: true,
      resultSummary: true,
      tenantId: true,
      actorBookUserId: true,
      userId: true,
      requestKind: true,
    },
    orderBy: { submittedAt: "asc" },
    take: 50,
  });

  let promoted = 0;
  for (const row of rows) {
    const existingBg = readVideoBackgroundGeneration(row.resultSummary);
    if (existingBg?.slotReleased) continue;

    const trace = readVolcengineTimingTrace(row.resultSummary);
    if (!trace) continue;

    const ageMs = nowMs - row.submittedAt.getTime();
    const vendorStuck = isVolcengineVendorStuck(trace, nowMs, VIDEO_BACKGROUND_UI_MS);
    const ageBackground = ageMs >= VIDEO_BACKGROUND_UI_MS;
    if (!vendorStuck && !ageBackground) continue;

    const breakdown = computeVolcengineTimingBreakdown({
      trace,
      submittedAtMs: row.submittedAt.getTime(),
      completedAtMs: null,
      nowMs,
    });
    let nextSummary = attachGatewayTimingToSummary(
      row.resultSummary,
      trace,
      breakdown,
    );
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
