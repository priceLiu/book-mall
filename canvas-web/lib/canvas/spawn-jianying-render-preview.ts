"use client";

import {
  absoluteNodePosition,
  ensureNodeDragHandles,
  nodeMeasuredSize,
  sortNodesForReactFlow,
} from "@/lib/canvas/normalize-graph-nodes";
import { selectSbv1NodeAfterSpawn } from "@/lib/canvas/sbv1-spawn-nodes";
import type {
  CanvasFlowEdge,
  CanvasFlowNode,
  CanvasNodeType,
  JianyingExportNodeData,
} from "@/lib/canvas/types";
import { flowPositionAtScreenPoint } from "@/lib/canvas/viewport-placement";

const GAP = 48;

/** 剪辑成片预览节点尺寸：竖屏成片友好（约 9:16） */
const CLIP_PREVIEW_W = 320;
const CLIP_PREVIEW_H = 560;

export const JIANYING_EXPORT_RENDER_OUT_HANDLE = "out_render";

type SpawnStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: CanvasNodeType,
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

/** 自动剪辑完成后 · 在导出节点右侧生成/更新 video-preview 并连线 */
export function spawnJianyingRenderPreviewNode(
  exportNodeId: string,
  videoUrl: string,
  store: SpawnStore,
  options?: { atScreen?: { x: number; y: number } },
): string {
  const { nodes, edges, addNode, setNodes, setEdges, updateNodeData } = store;
  const exportNode = nodes.find((n) => n.id === exportNodeId);
  if (!exportNode) return "";

  const existingEdge = edges.find(
    (e) =>
      e.source === exportNodeId &&
      e.sourceHandle === JIANYING_EXPORT_RENDER_OUT_HANDLE,
  );
  if (existingEdge) {
    const target = nodes.find((n) => n.id === existingEdge.target);
    if (target?.type === "video-preview") {
      updateNodeData(target.id, {
        label: "剪辑成片",
        videoUrl,
      });
      selectSbv1NodeAfterSpawn(setNodes, target.id);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
      }
      return target.id;
    }
  }

  const abs = absoluteNodePosition(exportNode, nodes);
  const { w: selfW, h: selfH } = nodeMeasuredSize(exportNode);
  const defaultX = abs.x + selfW + GAP;
  const defaultY = abs.y + Math.max(0, (selfH - CLIP_PREVIEW_H) / 2);
  const spawnPos = options?.atScreen
    ? flowPositionAtScreenPoint("video-preview", options.atScreen)
    : { x: defaultX, y: defaultY };
  const x = spawnPos.x;
  const y = spawnPos.y;

  const persistedUrl =
    videoUrl.trim() ||
    (
      (exportNode.data as JianyingExportNodeData).mediaRenderResult
        ?.downloadUrl ?? ""
    ).trim();

  const newId = addNode(
    "video-preview",
    { x, y },
    {
      label: "剪辑成片",
      ...(persistedUrl ? { videoUrl: persistedUrl } : {}),
    },
  );
  if (!newId) return "";

  setEdges((prev) => [
    ...prev,
    {
      id: `e-${exportNodeId}-${newId}-render`,
      source: exportNodeId,
      target: newId,
      sourceHandle: JIANYING_EXPORT_RENDER_OUT_HANDLE,
      targetHandle: "in_video",
    },
  ]);

  setNodes((prev) =>
    ensureNodeDragHandles(
      sortNodesForReactFlow(
        prev.map((n) =>
          n.id === newId
            ? {
                ...n,
                selected: true,
                width: CLIP_PREVIEW_W,
                height: CLIP_PREVIEW_H,
                style: {
                  ...n.style,
                  width: CLIP_PREVIEW_W,
                  height: CLIP_PREVIEW_H,
                },
              }
            : { ...n, selected: false },
        ),
      ),
    ),
  );

  // 立即落盘，避免刷新后预览节点丢失
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("canvas:flush-autosave"));
  }

  return newId;
}
