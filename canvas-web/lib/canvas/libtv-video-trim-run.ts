"use client";

import {
  buildSbv1VideoEngineNodeData,
  selectSbv1NodeAfterSpawn,
  spawnSbv1NeighborFromNode,
} from "./sbv1-spawn-nodes";
import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRIM,
  libtvLocalMediaJobRunningRuntime,
} from "./libtv-local-media-job";
import { postVideoTrim } from "./libtv-video-edit-client";

type TrimStore = {
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

function spawnTrimmedVideoTarget(
  sourceNodeId: string,
  store: TrimStore,
): string {
  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) throw new Error("源节点不存在");

  const anchorData = (anchor.data ?? {}) as Record<string, unknown>;
  const newId = spawnSbv1NeighborFromNode(
    sourceNodeId,
    "right",
    "sbv1-video-engine",
    store,
  );
  if (!newId) throw new Error("无法创建视频节点");

  store.setNodes((prev) =>
    prev.map((n) => {
      if (n.id !== newId) return n;
      const anchorW = anchor.width ?? SBV1_VIDEO_ENGINE_WIDTH;
      const anchorH = anchor.height;
      return {
        ...n,
        ...(typeof anchorW === "number" &&
        typeof anchorH === "number" &&
        anchorW > 0 &&
        anchorH > 0
          ? {
              width: anchorW,
              height: anchorH,
              style: { ...n.style, width: anchorW, height: anchorH },
            }
          : {}),
        data: {
          ...(n.data as Record<string, unknown>),
          ...buildSbv1VideoEngineNodeData({
            label: "裁剪片段",
            aspectRatio: anchorData.aspectRatio,
            mediaAspectPreset: anchorData.mediaAspectPreset,
            mediaNaturalW: anchorData.mediaNaturalW,
            mediaNaturalH: anchorData.mediaNaturalH,
            runtime: libtvLocalMediaJobRunningRuntime(
              LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRIM,
            ),
          }),
        },
      };
    }),
  );

  selectSbv1NodeAfterSpawn(store.setNodes, newId);
  return newId;
}

export type RunLibtvVideoTrimOpts = {
  sourceNodeId: string;
  sourceVideoUrl: string;
  projectId: string | null;
  startSec: number;
  endSec: number;
  store: TrimStore;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
};

export async function runLibtvVideoTrim(
  opts: RunLibtvVideoTrimOpts,
): Promise<string> {
  const targetId = spawnTrimmedVideoTarget(opts.sourceNodeId, opts.store);

  try {
    const result = await postVideoTrim({
      sourceVideoUrl: opts.sourceVideoUrl,
      projectId: opts.projectId,
      startSec: opts.startSec,
      endSec: opts.endSec,
    });

    opts.updateNodeData(targetId, {
      label: "裁剪片段",
      runtime: {
        status: "done",
        ossUrl: result.videoUrl,
        ephemeralUrl: result.videoUrl,
        posterUrl: result.posterUrl,
        failCode: undefined,
        failMessage: undefined,
        localJobKind: undefined,
      },
    });

    return targetId;
  } catch (e) {
    const message = e instanceof Error ? e.message : "裁剪失败";
    opts.updateNodeData(targetId, {
      runtime: {
        status: "error",
        failCode: "VIDEO_TRIM",
        failMessage: message,
        localJobKind: undefined,
      },
    });
    throw e;
  }
}
