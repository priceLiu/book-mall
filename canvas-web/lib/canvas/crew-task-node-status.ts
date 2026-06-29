import { resolveCrewBulletinAnchor } from "./crew-bulletin-context";
import type { CrewTaskStatus } from "./crew-bulletin-types";
import { CREW_TASK_STATUS_LABELS } from "./crew-bulletin-types";
import type { CanvasFlowNode, CanvasGraph } from "./types";

/** 公告条任务快照 · 仅 bulletin 变更时变化（节点拖拽不触发） */
export function crewBulletinTasksSignature(state: {
  nodes: CanvasFlowNode[];
  graphMeta: CanvasGraph["meta"] | null | undefined;
}): string {
  const anchor = resolveCrewBulletinAnchor(
    state.nodes,
    state.graphMeta ?? undefined,
  );
  const tasks = anchor?.bulletin?.tasks;
  if (!tasks?.length) return "";
  return tasks
    .map((t) => `${t.id}:${t.status}:${t.canvasNodeId ?? ""}`)
    .join(";");
}

export function crewTaskStatusForNodeId(
  nodes: CanvasFlowNode[],
  graphMeta: CanvasGraph["meta"] | null | undefined,
  nodeId: string,
): CrewTaskStatus | undefined {
  const anchor = resolveCrewBulletinAnchor(nodes, graphMeta ?? undefined);
  const tasks = anchor?.bulletin?.tasks;
  if (!tasks?.length) return undefined;
  const byNode = tasks.find((t) => t.canvasNodeId === nodeId);
  if (byNode) return byNode.status;
  const node = nodes.find((n) => n.id === nodeId);
  const crewTaskId = (node?.data as { crewTaskId?: string } | undefined)
    ?.crewTaskId;
  if (!crewTaskId) return undefined;
  return tasks.find((t) => t.id === crewTaskId)?.status;
}

export type CrewTaskNodeBadgeTier = "done" | "active" | "idle";

export function crewTaskNodeBadgeTier(
  status: CrewTaskStatus,
): CrewTaskNodeBadgeTier {
  if (status === "done") return "done";
  if (
    status === "claimed" ||
    status === "generating" ||
    status === "review" ||
    status === "blocked"
  ) {
    return "active";
  }
  return "idle";
}

/** 与公告栏 phase 步骤三色一致：完成 / 进行中 / 未开始 */
export function crewTaskNodeBadgeClass(tier: CrewTaskNodeBadgeTier): string {
  switch (tier) {
    case "done":
      return "border border-emerald-400/40 bg-emerald-500/12 text-emerald-100";
    case "active":
      return "border border-amber-400/40 bg-amber-500/12 text-amber-100";
    default:
      return "border border-white/15 bg-black/20 text-white/45";
  }
}

export function crewTaskNodeBadgeLabel(status: CrewTaskStatus): string {
  return CREW_TASK_STATUS_LABELS[status] ?? status;
}
