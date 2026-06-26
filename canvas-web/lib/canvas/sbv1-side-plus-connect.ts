import type { Connection } from "@xyflow/react";
import { isSbv1MediaGroup } from "./sbv1-media-group-meta";
import { isPro2StyledGroup } from "./pro2-media-group-meta";
import { isSbv1VideoEngineRefImageNode } from "./sbv1-upstream-ref-links";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** sbv1 左侧 + 拖线：统一为 sbv1-image → sbv1-video-engine (in_ref) */
export function normalizeSbv1PlusLeftConnection(
  connection: Connection,
  nodes: CanvasFlowNode[],
): Connection {
  if (connection.sourceHandle !== "plus_left") return connection;
  if (!connection.source || !connection.target) return connection;

  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);

  if (sourceNode?.type === "sbv1-video-engine") {
    return {
      source: connection.target,
      target: connection.source,
      sourceHandle: connection.targetHandle ?? "image",
      targetHandle: "in_ref",
    };
  }

  if (
    sourceNode?.type === "sbv1-image" &&
    targetNode?.type === "sbv1-video-engine"
  ) {
    return {
      source: connection.source,
      target: connection.target,
      sourceHandle: "image",
      targetHandle: "in_ref",
    };
  }

  return connection;
}

/**
 * 分组右侧 + 拖到视频引擎：展开为组内每张图片 → engine (in_ref)。
 * 与 spawnSbv1VideoEngineFromGroup 菜单一致；同时覆盖影视专业 2.0 媒体组
 * （分镜图组等，子节点为 story-pro2-image），与 分镜视频 1.0 行为对齐。
 */
export function expandSbv1GroupOutMediaConnection(
  connection: Connection,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] | null {
  if (connection.sourceHandle !== "out_media") return null;
  if (!connection.source || !connection.target) return null;

  const sourceNode = nodes.find((n) => n.id === connection.source);
  const targetNode = nodes.find((n) => n.id === connection.target);
  if (sourceNode?.type !== "group" || targetNode?.type !== "sbv1-video-engine") {
    return null;
  }
  if (
    !isSbv1MediaGroup(sourceNode, nodes) &&
    !isPro2StyledGroup(sourceNode, nodes)
  ) {
    return null;
  }

  const children = nodes.filter(
    (n) => n.parentId === connection.source && isSbv1VideoEngineRefImageNode(n),
  );
  if (!children.length) return [];

  const engineId = connection.target;
  const out: CanvasFlowEdge[] = [];
  for (const [i, child] of children.entries()) {
    const dup = edges.some(
      (e) =>
        e.source === child.id &&
        e.target === engineId &&
        (e.targetHandle === "in_ref" || !e.targetHandle),
    );
    if (dup) continue;
    out.push({
      id: `e-${child.id}-${engineId}-${i}`,
      source: child.id,
      target: engineId,
      sourceHandle: "image",
      targetHandle: "in_ref",
      animated: false,
    });
  }
  return out;
}
