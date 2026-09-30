"use client";

import { nanoid } from "nanoid";

import {
  absoluteNodePosition,
  nodeMeasuredSize,
} from "./normalize-graph-nodes";
import { buildPro2GeneralTextNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  LIBTV_LOCAL_MEDIA_JOB_VIDEO_SUBTITLE_EXTRACT,
  libtvLocalMediaJobRunningRuntime,
} from "./libtv-local-media-job";
import { postVideoSubtitleExtract } from "./libtv-video-edit-client";

const GAP = 56;

type SubtitleExtractStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: CanvasFlowNode["type"],
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
};

function spawnSubtitleTextTarget(
  sourceNodeId: string,
  store: SubtitleExtractStore,
): string {
  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) throw new Error("源节点不存在");

  const abs = absoluteNodePosition(anchor, store.nodes);
  const { w: selfW } = nodeMeasuredSize(anchor);
  const anchorW = anchor.width ?? selfW ?? SBV1_VIDEO_ENGINE_WIDTH;

  const textId = store.addNode(
    "story-pro2-starter",
    { x: abs.x + anchorW + GAP, y: abs.y },
    buildPro2GeneralTextNodeData({
      label: "提取字幕",
      pro2TextPurpose: "general",
      themeInput: "",
      runtime: libtvLocalMediaJobRunningRuntime(
        LIBTV_LOCAL_MEDIA_JOB_VIDEO_SUBTITLE_EXTRACT,
      ),
    }),
  );
  if (!textId) throw new Error("无法创建文本节点");

  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: sourceNodeId,
      target: textId,
      sourceHandle: "out_video",
      targetHandle: "in_text",
    },
  ]);

  selectPro2NodeAfterSpawn(store.setNodes, textId);
  return textId;
}

export type RunLibtvVideoSubtitleExtractOpts = {
  sourceNodeId: string;
  sourceVideoUrl: string;
  projectId: string | null;
  store: SubtitleExtractStore;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
};

export async function runLibtvVideoSubtitleExtract(
  opts: RunLibtvVideoSubtitleExtractOpts,
): Promise<string> {
  const targetId = spawnSubtitleTextTarget(opts.sourceNodeId, opts.store);

  try {
    const result = await postVideoSubtitleExtract({
      sourceVideoUrl: opts.sourceVideoUrl,
      projectId: opts.projectId,
    });

    const srtBody =
      result.srt.trim() ||
      (result.noSpeech ? "（未识别到语音，无字幕内容）" : "");

    opts.updateNodeData(targetId, {
      label: "提取字幕",
      themeInput: srtBody,
      libtvVideoSubtitleSrt: result.srt,
      libtvVideoSubtitleSegments: result.segments,
      runtime: {
        status: "done",
        failCode: undefined,
        failMessage: undefined,
        localJobKind: undefined,
      },
    });

    return targetId;
  } catch (e) {
    const message = e instanceof Error ? e.message : "提取字幕失败";
    opts.updateNodeData(targetId, {
      runtime: {
        status: "error",
        failCode: "VIDEO_SUBTITLE_EXTRACT",
        failMessage: message,
        localJobKind: undefined,
      },
    });
    throw e;
  }
}
