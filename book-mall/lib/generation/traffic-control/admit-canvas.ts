import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { isTrafficControlEnabled } from "./constants";
import { resolveCanvasProjectTrafficScope, type TrafficScope } from "./scope-key";

export function isCanvasVideoTrafficKind(payload: Record<string, unknown> | null): boolean {
  if (!payload) return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

/** 创建 QUEUED 画布视频任务（不 RESERVE、不调厂商） */
export async function admitCanvasVideoTask(input: {
  projectId: string;
  nodeId: string;
  actorUserId: string;
  scope?: TrafficScope;
  data: Omit<
    Prisma.CanvasGenerationTaskUncheckedCreateInput,
    "projectId" | "nodeId" | "status" | "queuedAt" | "tenantId" | "actorUserId"
  >;
}): Promise<CanvasGenerationTask> {
  const scope =
    input.scope ??
    (await resolveCanvasProjectTrafficScope(input.projectId, input.actorUserId));
  const now = new Date();

  return prisma.canvasGenerationTask.create({
    data: {
      ...input.data,
      projectId: input.projectId,
      nodeId: input.nodeId,
      status: isTrafficControlEnabled() ? "QUEUED" : "PENDING",
      queuedAt: isTrafficControlEnabled() ? now : undefined,
      tenantId: scope.tenantId ?? null,
      actorUserId: input.actorUserId,
    },
  });
}

export function shouldUseTrafficQueueForCanvasVideo(): boolean {
  return isTrafficControlEnabled();
}
