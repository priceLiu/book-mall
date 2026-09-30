"use client";

import { buildPro2ImageNodeData } from "./pro2-spawn-nodes";
import { spawnPro2ImageNeighbor } from "./libtv-pro2-image-neighbor-spawn";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  LIBTV_LOCAL_MEDIA_JOB_VIDEO_FRAME_EXTRACT,
  libtvLocalMediaJobRunningRuntime,
} from "./libtv-local-media-job";
import { postVideoFrameExtract } from "./libtv-video-edit-client";

type FrameExtractStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: CanvasFlowNode["type"],
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: CanvasFlowNode["type"],
    groupId: string,
    relativePosition: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

export function libtvVideoFrameExtractLabel(
  mode: "first" | "last" | "at",
): string {
  if (mode === "first") return "首帧";
  if (mode === "last") return "尾帧";
  return "自定义帧";
}

function spawnFrameImageTarget(
  sourceNodeId: string,
  store: FrameExtractStore,
  mode: "first" | "last" | "at",
): string {
  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) throw new Error("源节点不存在");
  const anchorData = (anchor.data ?? {}) as Record<string, unknown>;
  const label = libtvVideoFrameExtractLabel(mode);

  return spawnPro2ImageNeighbor({
    sourceNodeId,
    resultLabel: label,
    nodes: store.nodes,
    addNode: (type, position, data) =>
      store.addNode(type, position, data),
    setNodes: store.setNodes,
    setEdges: store.setEdges,
    sourceHandle: "out_video",
    copyAnchorDimensions: true,
    imageNodeData: buildPro2ImageNodeData({
      label,
      imageMode: "upload",
      mediaAspectPreset: anchorData.mediaAspectPreset,
      mediaNaturalW: anchorData.mediaNaturalW,
      mediaNaturalH: anchorData.mediaNaturalH,
      runtime: libtvLocalMediaJobRunningRuntime(
        LIBTV_LOCAL_MEDIA_JOB_VIDEO_FRAME_EXTRACT,
      ),
    }),
  });
}

export type RunLibtvVideoFrameExtractOpts = {
  mode: "first" | "last" | "at";
  atSec?: number;
  sourceNodeId: string;
  sourceVideoUrl: string;
  projectId: string | null;
  store: FrameExtractStore;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
};

export async function runLibtvVideoFrameExtract(
  opts: RunLibtvVideoFrameExtractOpts,
): Promise<string> {
  const targetId = spawnFrameImageTarget(
    opts.sourceNodeId,
    opts.store,
    opts.mode,
  );

  try {
    const result = await postVideoFrameExtract({
      sourceVideoUrl: opts.sourceVideoUrl,
      projectId: opts.projectId,
      mode: opts.mode,
      atSec: opts.atSec,
    });

    opts.updateNodeData(targetId, {
      imageMode: "upload",
      ossUrl: result.imageUrl,
      runtime: {
        status: "done",
        ossUrl: result.imageUrl,
        ephemeralUrl: result.imageUrl,
        failCode: undefined,
        failMessage: undefined,
        localJobKind: undefined,
      },
      libtvExtractedFromVideoNodeId: opts.sourceNodeId,
      libtvCapturedAtSec: result.capturedAtSec,
      libtvFrameExtractKind: opts.mode,
    });

    return targetId;
  } catch (e) {
    const message = e instanceof Error ? e.message : "截帧失败";
    opts.updateNodeData(targetId, {
      runtime: {
        status: "error",
        failCode: "VIDEO_FRAME_EXTRACT",
        failMessage: message,
        localJobKind: undefined,
      },
    });
    throw e;
  }
}
