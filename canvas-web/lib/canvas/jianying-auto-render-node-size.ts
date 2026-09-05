import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  SBV1_VIDEO_ENGINE_HEIGHT,
  SBV1_VIDEO_ENGINE_WIDTH,
} from "./sbv1-node-chrome";

const SIZE_ANCHOR_TYPES = new Set(["sbv1-video-engine", "sbv1-image"]);

function readNodeMeasuredSize(node: CanvasFlowNode): { w: number; h: number } {
  const style = node.style as { width?: number; height?: number } | undefined;
  const w = node.width ?? style?.width ?? SBV1_VIDEO_ENGINE_WIDTH;
  const h = node.height ?? style?.height ?? SBV1_VIDEO_ENGINE_HEIGHT;
  return {
    w: Number(w) || SBV1_VIDEO_ENGINE_WIDTH,
    h: Number(h) || SBV1_VIDEO_ENGINE_HEIGHT,
  };
}

/** 创建「自动成片」时与上游视频/图片媒体卡外框对齐 */
export function resolveJianyingAutoRenderNodeSize(input: {
  anchorNode?: CanvasFlowNode | null;
  nodes: CanvasFlowNode[];
  edges?: CanvasFlowEdge[];
  replicateVideoEdgesFrom?: string;
  sourceNodes?: CanvasFlowNode[];
}): { width: number; height: number } {
  const candidates: CanvasFlowNode[] = [];

  for (const n of input.sourceNodes ?? []) {
    if (SIZE_ANCHOR_TYPES.has(n.type)) candidates.push(n);
  }
  if (input.anchorNode && SIZE_ANCHOR_TYPES.has(input.anchorNode.type)) {
    candidates.push(input.anchorNode);
  }

  const fromId = input.replicateVideoEdgesFrom ?? input.anchorNode?.id;
  if (fromId && input.edges) {
    for (const e of input.edges) {
      if (e.target !== fromId || e.targetHandle !== "in_video") continue;
      const src = input.nodes.find((n) => n.id === e.source);
      if (src && SIZE_ANCHOR_TYPES.has(src.type)) candidates.push(src);
    }
    if (input.anchorNode?.type === "jianying-export-pro2") {
      for (const e of input.edges) {
        if (e.target !== input.anchorNode.id) continue;
        const src = input.nodes.find((n) => n.id === e.source);
        if (src?.type === "sbv1-video-engine") candidates.push(src);
      }
    }
  }

  if (candidates.length === 0) {
    return {
      width: SBV1_VIDEO_ENGINE_WIDTH,
      height: SBV1_VIDEO_ENGINE_HEIGHT,
    };
  }

  let width = SBV1_VIDEO_ENGINE_WIDTH;
  let height = SBV1_VIDEO_ENGINE_HEIGHT;
  let bestArea = 0;
  for (const n of candidates) {
    const { w, h } = readNodeMeasuredSize(n);
    const area = w * h;
    if (area >= bestArea) {
      bestArea = area;
      width = w;
      height = h;
    }
  }
  return { width, height };
}

export function withFlowNodeDimensions(
  node: CanvasFlowNode,
  width: number,
  height: number,
): CanvasFlowNode {
  return {
    ...node,
    width,
    height,
    style: { ...node.style, width, height },
  };
}
