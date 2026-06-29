"use client";

import { useCallback, useMemo, useState } from "react";
import { useReactFlow } from "@xyflow/react";
import { resolveCrewBulletinAnchor } from "@/lib/canvas/crew-bulletin-context";
import {
  canCompleteCrewTaskFromNode,
  submitCrewBulletinTaskFromNode,
} from "@/lib/canvas/crew-bulletin-node-submit";
import { crewTaskStatusForNodeId } from "@/lib/canvas/crew-task-node-status";
import { selectLibtvNodeAfterDuplicate } from "@/lib/canvas/select-libtv-node";
import { useCanvasStore } from "@/lib/canvas/store";

/** 复制完整节点（含提示词 / 生成结果 / 参与制作标记） */
export function useLibtvNodeDuplicate(
  nodeId: string,
  rfNodeType?: string,
  onSelectAfterDuplicate?: (newId: string) => void,
) {
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const { setNodes: rfSetNodes } = useReactFlow();

  return useCallback(() => {
    const newId = duplicateNode(nodeId, { preserveContent: true });
    if (!newId) return null;
    if (rfNodeType) {
      selectLibtvNodeAfterDuplicate(rfSetNodes, newId, rfNodeType);
    }
    onSelectAfterDuplicate?.(newId);
    return newId;
  }, [
    duplicateNode,
    nodeId,
    rfNodeType,
    rfSetNodes,
    onSelectAfterDuplicate,
  ]);
}

/** 参与制作节点 · 提交「完成制作」 */
export function useCrewTaskCompleteProduction(nodeId: string) {
  const nodes = useCanvasStore((s) => s.nodes);
  const graphMeta = useCanvasStore((s) => s.graphMeta);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const patchGraphMeta = useCanvasStore((s) => s.patchGraphMeta);
  const [submitting, setSubmitting] = useState(false);

  const node = useMemo(
    () => nodes.find((n) => n.id === nodeId),
    [nodes, nodeId],
  );
  const crewTaskId = (node?.data as { crewTaskId?: string } | undefined)
    ?.crewTaskId;

  const anchor = useMemo(
    () => resolveCrewBulletinAnchor(nodes, graphMeta ?? undefined),
    [nodes, graphMeta],
  );

  const task = useMemo(() => {
    if (!crewTaskId || !anchor?.bulletin) return undefined;
    return anchor.bulletin.tasks.find((t) => t.id === crewTaskId);
  }, [crewTaskId, anchor]);

  const canComplete = useMemo(
    () => canCompleteCrewTaskFromNode(task, node),
    [task, node],
  );

  const onComplete = useCallback(async () => {
    if (!anchor?.bulletin || !canComplete || submitting) return;
    setSubmitting(true);
    try {
      submitCrewBulletinTaskFromNode(
        anchor,
        anchor.bulletin,
        nodeId,
        nodes,
        { updateNodeData, patchGraphMeta },
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    anchor,
    canComplete,
    submitting,
    nodeId,
    nodes,
    updateNodeData,
    patchGraphMeta,
  ]);

  return {
    hasCrewTask: Boolean(crewTaskId),
    canComplete,
    submitting,
    onComplete,
  };
}

/** 节点顶栏徽章 · 「参与制作」→ 点击提交后改为「完成制作」 */
export const CREW_NODE_PARTICIPATING_LABEL = "参与制作";
export const CREW_NODE_COMPLETED_LABEL = "完成制作";

export function crewNodeShowsParticipatingBadge(
  nodeId: string,
  nodes: Parameters<typeof crewTaskStatusForNodeId>[0],
  graphMeta: Parameters<typeof crewTaskStatusForNodeId>[1],
): boolean {
  const node = nodes.find((n) => n.id === nodeId);
  const crewTaskId = (node?.data as { crewTaskId?: string } | undefined)
    ?.crewTaskId;
  if (crewTaskId?.trim()) return true;
  const status = crewTaskStatusForNodeId(nodes, graphMeta, nodeId);
  return Boolean(status && status !== "unclaimed");
}

export function crewNodeCenterBadgeLabel(
  nodeId: string,
  nodes: Parameters<typeof crewTaskStatusForNodeId>[0],
  graphMeta: Parameters<typeof crewTaskStatusForNodeId>[1],
): string | null {
  if (!crewNodeShowsParticipatingBadge(nodeId, nodes, graphMeta)) return null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return CREW_NODE_PARTICIPATING_LABEL;
  const data = node.data as Record<string, unknown> | undefined;
  const crewTaskId = data?.crewTaskId;
  if (typeof crewTaskId !== "string") {
    const status = crewTaskStatusForNodeId(nodes, graphMeta, nodeId);
    if (status === "done") return CREW_NODE_COMPLETED_LABEL;
    return CREW_NODE_PARTICIPATING_LABEL;
  }

  const anchor = resolveCrewBulletinAnchor(nodes, graphMeta ?? undefined);
  const task = anchor?.bulletin?.tasks.find((t) => t.id === crewTaskId);

  if (data?.crewTaskLastSubmittedAt) return CREW_NODE_COMPLETED_LABEL;
  if (task?.forkSubmissions?.some((s) => s.nodeId === nodeId)) {
    return CREW_NODE_COMPLETED_LABEL;
  }
  if (
    task?.status === "done" &&
    task.canvasNodeId === nodeId &&
    data?.crewTaskFork !== true
  ) {
    return CREW_NODE_COMPLETED_LABEL;
  }
  return CREW_NODE_PARTICIPATING_LABEL;
}
