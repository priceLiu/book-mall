import type { GatewayClientSource } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type GatewayLogAppTaskLink = {
  appTaskId: string;
  appTaskKind: "canvas" | "story";
  nodeId?: string;
};

type LogRowForLink = {
  id: string;
  storyTaskId?: string | null;
  clientSource?: GatewayClientSource | null;
};

/** 批量解析 Gateway 日志 ↔ 上游应用任务（Canvas 节点 task / Story task）。 */
export async function resolveGatewayLogAppTaskLinks(
  logs: LogRowForLink[],
): Promise<Map<string, GatewayLogAppTaskLink>> {
  const out = new Map<string, GatewayLogAppTaskLink>();
  if (!logs.length) return out;

  const logIds = logs.map((l) => l.id);
  const storyTaskIdsFromLog = [
    ...new Set(
      logs.map((l) => l.storyTaskId?.trim()).filter((id): id is string => !!id),
    ),
  ];

  const canvasByLogId = new Map<string, { id: string; nodeId: string }>();
  const canvasByTaskId = new Map<string, { id: string; nodeId: string }>();

  if (logIds.length > 0) {
    const canvasRows = await prisma.canvasGenerationTask.findMany({
      where: {
        deletedAt: null,
        OR: logIds.map((logId) => ({
          inputPayload: { path: ["gatewayLogId"], equals: logId },
        })),
      },
      select: { id: true, nodeId: true, inputPayload: true },
    });
    for (const row of canvasRows) {
      const payload = row.inputPayload as { gatewayLogId?: unknown };
      const gwId =
        typeof payload.gatewayLogId === "string" ? payload.gatewayLogId.trim() : "";
      if (gwId) canvasByLogId.set(gwId, { id: row.id, nodeId: row.nodeId });
      canvasByTaskId.set(row.id, { id: row.id, nodeId: row.nodeId });
    }
  }

  if (storyTaskIdsFromLog.length > 0) {
    const extraCanvas = await prisma.canvasGenerationTask.findMany({
      where: { id: { in: storyTaskIdsFromLog }, deletedAt: null },
      select: { id: true, nodeId: true },
    });
    for (const row of extraCanvas) {
      canvasByTaskId.set(row.id, { id: row.id, nodeId: row.nodeId });
    }
  }

  const storyByLogId = new Map<string, string>();
  if (logIds.length > 0) {
    const storyRows = await prisma.storyGenerationTask.findMany({
      where: { gatewayLogId: { in: logIds } },
      select: { id: true, gatewayLogId: true },
    });
    for (const row of storyRows) {
      const gwId = row.gatewayLogId?.trim();
      if (gwId) storyByLogId.set(gwId, row.id);
    }
  }

  for (const log of logs) {
    const directTaskId = log.storyTaskId?.trim();
    const canvasFromLog = canvasByLogId.get(log.id);
    const canvasFromTaskId = directTaskId
      ? canvasByTaskId.get(directTaskId)
      : undefined;
    const canvasHit = canvasFromLog ?? canvasFromTaskId;

    if (canvasHit) {
      out.set(log.id, {
        appTaskId: canvasHit.id,
        appTaskKind: "canvas",
        nodeId: canvasHit.nodeId,
      });
      continue;
    }

    const storyId = storyByLogId.get(log.id);
    if (storyId) {
      out.set(log.id, {
        appTaskId: storyId,
        appTaskKind: "story",
      });
      continue;
    }

    if (directTaskId && log.clientSource === "STORY") {
      out.set(log.id, {
        appTaskId: directTaskId,
        appTaskKind: "story",
      });
    } else if (directTaskId && log.clientSource === "CANVAS") {
      out.set(log.id, {
        appTaskId: directTaskId,
        appTaskKind: "canvas",
      });
    } else if (directTaskId) {
      out.set(log.id, {
        appTaskId: directTaskId,
        appTaskKind: "story",
      });
    }
  }

  return out;
}
