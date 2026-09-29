"use client";

import { nanoid } from "nanoid";

import {
  absoluteNodePosition,
  nodeMeasuredSize,
} from "./normalize-graph-nodes";
import {
  buildPro2AudioNodeData,
} from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_AUDIO_NODE_HEIGHT,
  PRO2_AUDIO_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import {
  buildSbv1VideoEngineNodeData,
  selectSbv1NodeAfterSpawn,
  spawnSbv1NeighborFromNode,
} from "./sbv1-spawn-nodes";
import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  libtvLocalMediaJobRunningRuntime,
  LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT,
} from "./libtv-local-media-job";

const GAP = 48;

export type LibtvVideoTrackSplitMode = "strip-audio" | "extract-audio";

type TrackSplitStore = {
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

function runningRuntime() {
  return libtvLocalMediaJobRunningRuntime(
    LIBTV_LOCAL_MEDIA_JOB_VIDEO_TRACK_SPLIT,
  );
}

function spawnAudioTarget(
  sourceNodeId: string,
  store: TrackSplitStore,
): string {
  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) throw new Error("源节点不存在");

  const abs = absoluteNodePosition(anchor, store.nodes);
  const { w: selfW } = nodeMeasuredSize(anchor);
  const x = abs.x + selfW + GAP;
  const y = abs.y;

  const newId = store.addNode(
    "story-pro2-audio",
    { x, y },
    buildPro2AudioNodeData({
      label: "分离音频",
      runtime: runningRuntime(),
    }),
  );
  if (!newId) throw new Error("无法创建音频节点");

  store.setNodes((prev) =>
    prev.map((n) =>
      n.id === newId
        ? {
            ...n,
            width: PRO2_AUDIO_NODE_WIDTH,
            height: PRO2_AUDIO_NODE_HEIGHT,
            style: {
              ...n.style,
              width: PRO2_AUDIO_NODE_WIDTH,
              height: PRO2_AUDIO_NODE_HEIGHT,
            },
          }
        : n,
    ),
  );

  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: sourceNodeId,
      target: newId,
      sourceHandle: "out_video",
      targetHandle: "in_audio",
    },
  ]);

  selectPro2NodeAfterSpawn(store.setNodes, newId);
  return newId;
}

function spawnSilentVideoTarget(
  sourceNodeId: string,
  store: TrackSplitStore,
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
            label: "去原音",
            aspectRatio: anchorData.aspectRatio,
            mediaAspectPreset: anchorData.mediaAspectPreset,
            mediaNaturalW: anchorData.mediaNaturalW,
            mediaNaturalH: anchorData.mediaNaturalH,
            runtime: runningRuntime(),
          }),
        },
      };
    }),
  );

  selectSbv1NodeAfterSpawn(store.setNodes, newId);
  return newId;
}

type RunTrackSplitOpts = {
  mode: LibtvVideoTrackSplitMode;
  sourceNodeId: string;
  sourceVideoUrl: string;
  projectId: string | null;
  store: TrackSplitStore;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
};

export async function runLibtvVideoTrackSplit(
  opts: RunTrackSplitOpts,
): Promise<string> {
  const targetId =
    opts.mode === "strip-audio"
      ? spawnSilentVideoTarget(opts.sourceNodeId, opts.store)
      : spawnAudioTarget(opts.sourceNodeId, opts.store);

  try {
    const res = await fetch("/api/book-mall/api/platform/v1/video-track-split", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: opts.mode,
        sourceVideoUrl: opts.sourceVideoUrl,
        projectId: opts.projectId ?? undefined,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      videoUrl?: string;
      posterUrl?: string;
      audioUrl?: string;
    };
    if (!res.ok) {
      throw new Error(
        formatVideoTrackSplitClientError(data.message ?? data.error, res.status),
      );
    }

    if (opts.mode === "strip-audio") {
      const videoUrl = data.videoUrl?.trim();
      if (!videoUrl) throw new Error("未获得无声视频");
      opts.updateNodeData(targetId, {
        label: "去原音",
        runtime: {
          status: "done",
          ossUrl: videoUrl,
          ephemeralUrl: videoUrl,
          posterUrl: data.posterUrl?.trim() || undefined,
          failMessage: undefined,
          failCode: undefined,
        },
      });
    } else {
      const audioUrl = data.audioUrl?.trim();
      if (!audioUrl) throw new Error("未获得分离音频");
      opts.updateNodeData(targetId, {
        label: "分离音频",
        ossUrl: audioUrl,
        runtime: {
          status: "done",
          ossUrl: audioUrl,
          ephemeralUrl: audioUrl,
          failMessage: undefined,
          failCode: undefined,
        },
      });
    }

    return targetId;
  } catch (e) {
    const message = formatVideoTrackSplitClientError(
      e instanceof Error ? e.message : "处理失败",
    );
    opts.updateNodeData(targetId, {
      runtime: {
        status: "error",
        failCode: "VIDEO_TRACK_SPLIT",
        failMessage: message,
      },
    });
    throw e;
  }
}

export function formatVideoTrackSplitClientError(
  raw: string | undefined,
  status?: number,
): string {
  const t = (raw ?? "").trim();
  if (
    t === "book_mall_proxy_failed" ||
    t.includes("book_mall_proxy_failed") ||
    status === 502
  ) {
    return "主站处理超时或连接中断，请稍后重试";
  }
  if (
    /socket disconnected|secure TLS|aliyuncs\.com|GET https:\/\//i.test(t)
  ) {
    return "成片读取或写入云存储失败，请稍后重试";
  }
  return t || "处理失败";
}

/** 源节点是否已有可处理的 OSS/HTTPS 成片 */
export function libtvVideoTrackSplitSourceReady(data: {
  runtime?: { ossUrl?: string; ephemeralUrl?: string };
}): string | undefined {
  const url =
    data.runtime?.ossUrl?.trim() || data.runtime?.ephemeralUrl?.trim() || "";
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
    return undefined;
  }
  return url;
}
