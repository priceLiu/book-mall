/**
 * 画布 · 持续后台生成中的视频任务（项目级列表 + 恢复）。
 */
import type { CanvasGenerationTask } from "@prisma/client";

import { isCanvasVolcengineVideoTaskPayload } from "@/lib/canvas/canvas-constants";
import {
  isRecoverableVolcengineStallFailCode,
  isVideoBackgroundGenerationAge,
  readVideoBackgroundGeneration,
  VIDEO_BACKGROUND_GENERATION_LABEL,
  VIDEO_BACKGROUND_RECOVER_HINT,
  VIDEO_BACKGROUND_WAIT_HINT,
} from "@/lib/gateway/video-background-generation";
import { VIDEO_BACKGROUND_UI_MS } from "@/lib/gateway/video-task-wait-policy";
import { prisma } from "@/lib/prisma";

export type CanvasBackgroundVideoTaskRow = {
  taskId: string;
  nodeId: string;
  status: string;
  failCode: string | null;
  gatewayLogId: string | null;
  gatewayStatus: string | null;
  vendorTaskId: string | null;
  submittedAt: string;
  ageSec: number;
  kind: "background_generating" | "recoverable_stall" | "ready_to_load";
  label: string;
  hint: string;
  canRecover: boolean;
};

function taskPayload(
  task: Pick<CanvasGenerationTask, "inputPayload">,
): Record<string, unknown> | null {
  if (!task.inputPayload || typeof task.inputPayload !== "object") return null;
  return task.inputPayload as Record<string, unknown>;
}

function nodeLabelFromCanvas(canvas: unknown, nodeId: string): string {
  if (!canvas || typeof canvas !== "object") return nodeId;
  const nodes = (canvas as { nodes?: Array<{ id: string; data?: { label?: string } }> })
    .nodes;
  const node = nodes?.find((n) => n.id === nodeId);
  const label = node?.data?.label?.trim();
  return label || nodeId;
}

/**
 * 终态任务(FAILED/SUCCEEDED)回看窗口。
 * 该端点是前台轮询热路径,旧实现把 FAILED/SUCCEEDED 全历史(take 200)连 inputPayload 一起拉,
 * 等于每次轮询都重读冷数据。动静分离原则:在飞任务不限时(本就少),终态只看近窗——
 * 超窗的成功任务媒体早已落节点、失败任务也早超出「可恢复」时效,无需再拉。
 * 火山后台视频最长 ~45min,6h 足以覆盖「刚结束/可恢复」的全部场景。
 */
const BACKGROUND_VIDEO_TERMINAL_LOOKBACK_MS = 6 * 60 * 60 * 1000;
const BACKGROUND_VIDEO_TASK_TAKE = 100;

export async function listCanvasProjectBackgroundVideoTasks(input: {
  userId: string;
  projectId: string;
}): Promise<CanvasBackgroundVideoTaskRow[]> {
  // 仅做归属校验,不在此拉整张 canvas JSON(常见情况是没有后台任务,拉了就是浪费)。
  const project = await prisma.canvasProject.findFirst({
    where: { id: input.projectId, userId: input.userId },
    select: { id: true },
  });
  if (!project) return [];

  const terminalCutoff = new Date(Date.now() - BACKGROUND_VIDEO_TERMINAL_LOOKBACK_MS);
  const tasks = await prisma.canvasGenerationTask.findMany({
    where: {
      projectId: input.projectId,
      OR: [
        // 在飞:数量天然少,命中在飞部分索引,不限时。
        { status: { in: ["SUBMITTED", "PENDING", "DISPATCHING"] } },
        // 终态:只看近窗,避免每次轮询重扫全历史。
        { status: { in: ["FAILED", "SUCCEEDED"] }, updatedAt: { gte: terminalCutoff } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: BACKGROUND_VIDEO_TASK_TAKE,
    select: {
      id: true,
      nodeId: true,
      status: true,
      failCode: true,
      failMessage: true,
      kieTaskId: true,
      submittedAt: true,
      createdAt: true,
      inputPayload: true,
      ossUrl: true,
      ephemeralUrl: true,
    },
  });

  const now = Date.now();
  const out: CanvasBackgroundVideoTaskRow[] = [];

  type Candidate = {
    task: (typeof tasks)[number];
    payload: Record<string, unknown>;
    gatewayLogId: string | null;
    since: Date;
    ageSec: number;
  };
  const candidates: Candidate[] = [];

  for (const task of tasks) {
    const payload = taskPayload(task);
    if (!payload || !isCanvasVolcengineVideoTaskPayload(payload)) continue;

    const gatewayLogId =
      typeof payload.gatewayLogId === "string"
        ? payload.gatewayLogId.trim()
        : null;
    const since = task.submittedAt ?? task.createdAt;
    const ageSec = Math.max(0, Math.floor((now - since.getTime()) / 1000));

    candidates.push({ task, payload, gatewayLogId, since, ageSec });
  }

  const gatewayLogIds = [
    ...new Set(
      candidates
        .map((c) => c.gatewayLogId)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const gatewayLogs =
    gatewayLogIds.length > 0
      ? await prisma.gatewayRequestLog.findMany({
          where: { id: { in: gatewayLogIds } },
          select: { id: true, status: true, failCode: true, resultSummary: true },
        })
      : [];
  const gatewayLogMap = new Map(gatewayLogs.map((gl) => [gl.id, gl]));

  // 仅当确有候选任务时才拉整张 canvas(用于取节点名);无后台任务时不读这坨大 JSON。
  const canvas =
    candidates.length > 0
      ? (
          await prisma.canvasProject.findUnique({
            where: { id: project.id },
            select: { canvas: true },
          })
        )?.canvas ?? null
      : null;

  for (const { task, gatewayLogId, since, ageSec } of candidates) {

    const gl = gatewayLogId ? gatewayLogMap.get(gatewayLogId) : undefined;
    const gatewayStatus = gl?.status ?? null;
    const gatewayFailCode = gl?.failCode ?? null;
    const gatewayBg = Boolean(readVideoBackgroundGeneration(gl?.resultSummary)?.slotReleased);

    const hasMedia = Boolean(task.ossUrl?.trim() || task.ephemeralUrl?.trim());
    const inflight =
      task.status === "SUBMITTED" ||
      task.status === "PENDING" ||
      task.status === "DISPATCHING" ||
      gatewayStatus === "RUNNING" ||
      gatewayStatus === "PENDING";

    if (hasMedia && task.status === "SUCCEEDED" && !inflight) {
      continue;
    }

    const recoverableStall =
      (task.status === "FAILED" &&
        isRecoverableVolcengineStallFailCode(task.failCode)) ||
      (gatewayStatus === "FAILED" &&
        isRecoverableVolcengineStallFailCode(gatewayFailCode));

    const backgroundGenerating =
      inflight &&
      (gatewayBg ||
        isVideoBackgroundGenerationAge(
          task.submittedAt,
          task.createdAt,
          now,
          VIDEO_BACKGROUND_UI_MS,
        ));

    if (!backgroundGenerating && !recoverableStall) continue;

    const kind: CanvasBackgroundVideoTaskRow["kind"] = recoverableStall
      ? "recoverable_stall"
      : "background_generating";

    out.push({
      taskId: task.id,
      nodeId: task.nodeId,
      status: task.status,
      failCode: task.failCode,
      gatewayLogId,
      gatewayStatus,
      vendorTaskId: task.kieTaskId,
      submittedAt: since.toISOString(),
      ageSec,
      kind,
      label: nodeLabelFromCanvas(canvas, task.nodeId),
      hint: recoverableStall
        ? VIDEO_BACKGROUND_RECOVER_HINT
        : VIDEO_BACKGROUND_WAIT_HINT,
      canRecover: recoverableStall || kind === "background_generating",
    });
  }

  return out.sort((a, b) => b.ageSec - a.ageSec);
}

export { VIDEO_BACKGROUND_GENERATION_LABEL };
