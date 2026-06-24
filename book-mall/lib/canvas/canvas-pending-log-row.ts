/**
 * 方向 2：把画布视频「QUEUED / DISPATCHING 且尚未创建 Gateway 日志」的任务，
 * 合成为一条「排队中（待提交）」日志行，使用户点击生成后，Logs 页第一时间就能看到
 * 完整过程（点击 → 排队 → 派发 → 提交厂商 …），而不是等几十秒厂商提交后才出现。
 *
 * 字段与 gateway-web `GatewayLogRow` 子集对齐：可直接并入日志列表渲染。
 * 不冻结任何耗时 ms —— 由前端按 `canvasStartedAt + liveTick` 实时累计「出队前 / 总耗时」，
 * 因此本行是「活的」，每秒在前端递增，提交厂商后真实日志出现即被去重替换。
 */
import type { CanvasQueuedTaskRow } from "@/lib/canvas/canvas-queue-without-log";

export type CanvasPendingLogStatus = "QUEUED" | "DISPATCHING";

/** 与 gateway-web GatewayLogRow 必填字段对齐 + 排队专用扩展（pending / canvasTaskId）。 */
export type CanvasPendingLogRow = {
  id: string;
  /** 真实画布任务 id（前端用它与真实日志 storyTaskId / appTaskId 去重） */
  canvasTaskId: string;
  pending: true;
  model: string;
  endpoint: string;
  status: CanvasPendingLogStatus;
  requestKind: "VIDEO";
  providerKind: null;
  credentialKeyMasked: null;
  clientSource: "CANVAS";
  clientPage: string;
  externalTaskId: null;
  totalTokens: null;
  promptTokens: null;
  completionTokens: null;
  durationMs: null;
  storyTaskId: string;
  appTaskId: string;
  appTaskKind: "canvas";
  appTaskNodeId: string;
  storyProjectId: string;
  canvasStartedAt: string;
  /** 尚未提交厂商；为满足 GatewayLogRow.submittedAt: string，占位为 canvasStartedAt，前端展示覆盖为「—」 */
  submittedAt: string;
  completedAt: null;
  estimatedVendorCostYuan: null;
  failCode: null;
  failMessage: null;
  inputSummary: null;
  resultSummary: null;
};

export function buildCanvasPendingLogRow(
  task: CanvasQueuedTaskRow,
): CanvasPendingLogRow {
  const status: CanvasPendingLogStatus =
    task.status === "DISPATCHING" ? "DISPATCHING" : "QUEUED";
  const startedAt = task.trafficStartedAt;
  return {
    id: `pending:${task.id}`,
    canvasTaskId: task.id,
    pending: true,
    model: task.model ?? "",
    endpoint: "jobs/createTask",
    status,
    requestKind: "VIDEO",
    providerKind: null,
    credentialKeyMasked: null,
    clientSource: "CANVAS",
    clientPage: `canvas/${task.projectId}`,
    externalTaskId: null,
    totalTokens: null,
    promptTokens: null,
    completionTokens: null,
    durationMs: null,
    storyTaskId: task.id,
    appTaskId: task.id,
    appTaskKind: "canvas",
    appTaskNodeId: task.nodeId,
    storyProjectId: task.projectId,
    canvasStartedAt: startedAt,
    submittedAt: startedAt,
    completedAt: null,
    estimatedVendorCostYuan: null,
    failCode: null,
    failMessage: null,
    inputSummary: null,
    resultSummary: null,
  };
}

export function buildCanvasPendingLogRows(
  tasks: CanvasQueuedTaskRow[],
): CanvasPendingLogRow[] {
  return tasks.map(buildCanvasPendingLogRow);
}

/**
 * 去重：任务一旦提交厂商即转入 SUBMITTED/RUNNING（不再被排队查询命中），但缓存或竞态下
 * 可能短暂双出。前端拿到真实日志后，按真实日志携带的 storyTaskId / appTaskId 命中即丢弃排队行。
 */
export function dedupeCanvasPendingRows<T extends { canvasTaskId: string }>(
  pending: T[],
  realLogTaskIds: Iterable<string | null | undefined>,
): T[] {
  const seen = new Set<string>();
  for (const id of realLogTaskIds) {
    const trimmed = id?.trim();
    if (trimmed) seen.add(trimmed);
  }
  if (seen.size === 0) return pending;
  return pending.filter((p) => !seen.has(p.canvasTaskId));
}
