import type { Connection } from "@xyflow/react";
import { Clapperboard, Download, Sparkles, Video } from "lucide-react";
import type { Pro2AddMenuSection } from "./pro2-add-node-menu";
import { DEFAULT_HANDLE_BY_TYPE } from "./libtv-connection-snap";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

/** 框选批量 · 媒体上游（图 / 三视图 / 风格 / 道具 / 氛围 / 音频 / 文本等） */
export const BATCH_IMAGE_SOURCE_TYPES = new Set([
  "sbv1-image",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-style-asset",
  "story-pro2-prop",
  "story-pro2-mood",
  "story-pro2-audio",
]);

export const BATCH_TEXT_SOURCE_TYPES = new Set([
  "story-pro2-starter",
  "story-pro2-script-hub",
]);

export type BatchConnectMode = "video-export" | "media-pipeline";

export function isBatchImageSource(node: CanvasFlowNode): boolean {
  return BATCH_IMAGE_SOURCE_TYPES.has(node.type ?? "");
}

export function isBatchTextSource(node: CanvasFlowNode): boolean {
  return BATCH_TEXT_SOURCE_TYPES.has(node.type ?? "");
}

/** 框选批量短菜单 · 图生图 / 图生视频（与单节点完整 + 菜单区分） */
export const BATCH_MEDIA_SPAWN_MENU_ITEMS = [
  {
    id: "img2img",
    label: "图生图",
    icon: Sparkles,
    nodeType: "story-pro2-image",
  },
  {
    id: "img2video",
    label: "图生视频",
    icon: Video,
    nodeType: "sbv1-video-engine",
  },
] as const;

/** 框选批量出边 · 节点 type → source handle */
export const BATCH_OUT_HANDLE_BY_TYPE: Record<string, string> = {
  "sbv1-video-engine": "out_video",
  "sbv1-image": "image",
  "story-pro2-image": "image",
  "story-pro2-three-view": "image",
  "story-pro2-style-asset": "style",
  "story-pro2-prop": "image",
  "story-pro2-mood": "image",
  "story-pro2-audio": "image",
  "story-pro2-starter": "text",
  "story-pro2-script-hub": "text",
};

export function isBatchMediaPipelineSource(node: CanvasFlowNode): boolean {
  return isBatchImageSource(node) || isBatchTextSource(node);
}

export function nodeBatchOutHandle(node: CanvasFlowNode): string | null {
  const t = node.type ?? "";
  return BATCH_OUT_HANDLE_BY_TYPE[t] ?? null;
}

export function nodesEligibleForBatchOut(
  nodes: CanvasFlowNode[],
  ids: string[],
): CanvasFlowNode[] {
  return ids
    .map((id) => nodes.find((n) => n.id === id))
    .filter((n): n is CanvasFlowNode => !!n && !!nodeBatchOutHandle(n));
}

/** 框选 ≥2 个可批量节点时返回模式，否则 null */
export function classifyBatchConnectMode(
  sources: CanvasFlowNode[],
): BatchConnectMode | null {
  if (sources.length < 2) return null;
  if (sources.every((s) => s.type === "sbv1-video-engine")) {
    return "video-export";
  }
  if (sources.every((s) => isBatchMediaPipelineSource(s))) {
    return "media-pipeline";
  }
  return null;
}

/** 框选批量 + 菜单（media-pipeline → 图生图/图生视频；video-export → 成片/导出） */
export function resolveBatchConnectMenu(
  mode: BatchConnectMode,
): Pro2AddMenuSection[] {
  if (mode === "video-export") {
    return [
      {
        title: "工作环节",
        items: [
          {
            id: "auto-render",
            label: "自动成片",
            icon: Clapperboard,
            enabled: true,
            nodeType: "jianying-auto-render-pro2",
          },
          {
            id: "export",
            label: "导出剪辑",
            icon: Download,
            enabled: true,
            nodeType: "jianying-export-pro2",
          },
        ],
      },
    ];
  }
  return [
    {
      title: "批量连线",
      items: BATCH_MEDIA_SPAWN_MENU_ITEMS.map((item) => ({
        ...item,
        enabled: true,
      })),
    },
  ];
}

export function batchImageSpawnNodeType(
  sources: CanvasFlowNode[],
): "story-pro2-image" | "sbv1-image" {
  if (sources.length > 0 && sources.every((s) => s.type === "sbv1-image")) {
    return "sbv1-image";
  }
  return "story-pro2-image";
}

export function isBatchConnectSnapTarget(
  node: CanvasFlowNode,
  mode: BatchConnectMode,
): boolean {
  if (mode === "video-export") {
    return (
      node.type === "jianying-export-pro2" ||
      node.type === "jianying-auto-render-pro2"
    );
  }
  return (
    node.type === "sbv1-video-engine" ||
    isBatchMediaPipelineSource(node)
  );
}

export function batchConnectTargetHandleForSnap(
  target: CanvasFlowNode,
  source: CanvasFlowNode,
  mode: BatchConnectMode,
): string | null {
  if (
    mode === "video-export" &&
    (target.type === "jianying-export-pro2" ||
      target.type === "jianying-auto-render-pro2")
  ) {
    return "in_video";
  }
  const sourceHandle = nodeBatchOutHandle(source);
  if (!sourceHandle) return null;
  return pickBatchTargetHandle(target, source, sourceHandle);
}

export function pickBatchTargetHandle(
  targetNode: CanvasFlowNode,
  sourceNode: CanvasFlowNode,
  sourceHandle: string,
): string | null {
  const defaults = DEFAULT_HANDLE_BY_TYPE[String(targetNode.type ?? "")];
  if (
    (targetNode.type === "jianying-export-pro2" ||
      targetNode.type === "jianying-auto-render-pro2") &&
    sourceNode.type === "sbv1-video-engine" &&
    sourceHandle === "out_video"
  ) {
    return "in_video";
  }
  if (
    targetNode.type === "sbv1-video-engine" &&
    (sourceNode.type === "story-pro2-starter" ||
      sourceNode.type === "story-pro2-script-hub")
  ) {
    return "in_text";
  }
  if (
    targetNode.type === "sbv1-video-engine" &&
    sourceNode.type === "sbv1-video-engine" &&
    sourceHandle === "out_video"
  ) {
    return "in_motion_video";
  }
  if (
    targetNode.type === "sbv1-video-engine" &&
    (sourceNode.type === "sbv1-image" ||
      sourceNode.type === "story-pro2-image" ||
      sourceNode.type === "story-pro2-three-view" ||
      sourceNode.type === "story-pro2-prop" ||
      sourceNode.type === "story-pro2-mood" ||
      sourceNode.type === "story-pro2-audio" ||
      sourceNode.type === "story-pro2-style-asset")
  ) {
    return "in_ref";
  }
  return defaults?.target ?? null;
}

export function buildBatchConnectEdges(
  sources: CanvasFlowNode[],
  targetId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  explicitTargetHandle?: string,
): CanvasFlowEdge[] {
  const targetNode = nodes.find((n) => n.id === targetId);
  if (!targetNode) return [];

  const out: CanvasFlowEdge[] = [];
  for (const source of sources) {
    const sourceHandle = nodeBatchOutHandle(source);
    if (!sourceHandle) continue;
    const targetHandle =
      explicitTargetHandle ??
      pickBatchTargetHandle(targetNode, source, sourceHandle);
    if (!targetHandle) continue;

    const dup = edges.some(
      (e) =>
        e.source === source.id &&
        e.target === targetId &&
        (e.sourceHandle ?? null) === sourceHandle &&
        (e.targetHandle ?? null) === targetHandle,
    );
    if (dup) continue;

    out.push({
      id: `e-batch-${source.id}-${targetId}-${sourceHandle}-${Date.now()}-${out.length}`,
      source: source.id,
      target: targetId,
      sourceHandle,
      targetHandle,
      animated: false,
    });
  }
  return out;
}

/** 将 snap 单条连线转为批量（框选 + 拖到目标） */
export function expandBatchSnapConnection(
  connection: Connection,
  batchSourceIds: string[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] | null {
  if (!connection.target || batchSourceIds.length < 2) return null;
  const fromId = connection.source;
  if (!fromId || !batchSourceIds.includes(fromId)) return null;

  const sources = nodesEligibleForBatchOut(nodes, batchSourceIds);
  if (sources.length < 2) return null;

  return buildBatchConnectEdges(
    sources,
    connection.target,
    nodes,
    edges,
    connection.targetHandle ?? undefined,
  );
}
