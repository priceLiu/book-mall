import type { CanvasGenerationTask, Prisma } from "@prisma/client";

import { promptArchiveFieldsForTask } from "@/lib/canvas/canvas-task-prompt-archive";
import { prisma } from "@/lib/prisma";
import { isTrafficControlEnabled } from "./constants";
import { computeCanvasQueueDispatchAfter } from "./queue-dispatch-after";
import { resolveCanvasProjectTrafficScope, type TrafficScope } from "./scope-key";
import { withTrafficStartedAtPayload } from "./traffic-timing";

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
  const dispatchAfter = isTrafficControlEnabled()
    ? await computeCanvasQueueDispatchAfter(scope, now.getTime())
    : undefined;
  const inputPayload = input.data.inputPayload;
  const payloadObj =
    inputPayload &&
    typeof inputPayload === "object" &&
    !Array.isArray(inputPayload)
      ? (inputPayload as Record<string, unknown>)
      : {};
  const trafficPayload = isTrafficControlEnabled()
    ? (withTrafficStartedAtPayload(payloadObj, now.getTime()) as Prisma.InputJsonValue)
    : input.data.inputPayload;

  return prisma.canvasGenerationTask.create({
    data: {
      ...input.data,
      inputPayload: trafficPayload,
      ...promptArchiveFieldsForTask({
        kind: input.data.kind,
        inputPayload: input.data.inputPayload,
        textOutput: input.data.textOutput ?? null,
      }),
      projectId: input.projectId,
      nodeId: input.nodeId,
      status: isTrafficControlEnabled() ? "QUEUED" : "PENDING",
      queuedAt: isTrafficControlEnabled() ? now : undefined,
      dispatchAfter,
      tenantId: scope.tenantId ?? null,
      actorUserId: input.actorUserId,
    },
  });
}

export function shouldUseTrafficQueueForCanvasVideo(): boolean {
  return isTrafficControlEnabled();
}
