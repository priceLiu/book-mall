"use client";

import { nanoid } from "nanoid";

import {
  absoluteNodePosition,
  nodeMeasuredSize,
} from "./normalize-graph-nodes";
import { buildPro2AudioNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import {
  PRO2_AUDIO_NODE_HEIGHT,
  PRO2_AUDIO_NODE_WIDTH,
} from "./story-pro2-node-chrome";
import { GATEWAY_MINIMAX_VIDEO_PROVIDER_ID } from "./system-providers";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const GAP = 48;
const MINIMAX_SPEECH_MODEL = "MiniMax/speech-2.8-hd";

type CloneStore = {
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

function spawnClonedAudioTarget(
  sourceNodeId: string,
  store: CloneStore,
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
      label: "克隆配音",
      runtime: { status: "running" },
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
      sourceHandle: "audio",
      targetHandle: "in_audio",
    },
  ]);

  selectPro2NodeAfterSpawn(store.setNodes, newId);
  return newId;
}

export type RunLibtvAudioVoiceCloneOpts = {
  sourceNodeId: string;
  referenceAudioUrl: string;
  title: string;
  prompt: string;
  store: CloneStore;
  updateNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
};

export type LibtvAudioVoiceCloneApiResult = {
  audioUrl: string;
  voiceId: string;
  logId: string;
  message?: string;
  error?: string;
};

export function formatLibtvAudioVoiceCloneError(
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
  return t || "音色克隆失败";
}

export async function runLibtvAudioVoiceClone(
  opts: RunLibtvAudioVoiceCloneOpts,
): Promise<string> {
  const targetId = spawnClonedAudioTarget(opts.sourceNodeId, opts.store);

  try {
    const res = await fetch("/api/book-mall/api/platform/v1/canvas/voice-clone", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        referenceAudioUrl: opts.referenceAudioUrl,
        title: opts.title,
        prompt: opts.prompt,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as LibtvAudioVoiceCloneApiResult;
    if (!res.ok) {
      throw new Error(
        formatLibtvAudioVoiceCloneError(data.message ?? data.error, res.status),
      );
    }
    const audioUrl = data.audioUrl?.trim();
    const voiceId = data.voiceId?.trim();
    if (!audioUrl || !voiceId) {
      throw new Error("未获得克隆结果");
    }

    const voiceLabel = opts.title.trim() || "克隆音色";
    opts.updateNodeData(targetId, {
      label: voiceLabel,
      dockInput: opts.prompt.trim(),
      ossUrl: audioUrl,
      engine: {
        providerId: GATEWAY_MINIMAX_VIDEO_PROVIDER_ID,
        modelKey: MINIMAX_SPEECH_MODEL,
        params: {
          voice_id: voiceId,
          voice_label: voiceLabel,
        },
      },
      runtime: {
        status: "done",
        ossUrl: audioUrl,
        ephemeralUrl: audioUrl,
        failMessage: undefined,
        failCode: undefined,
      },
    });

    return targetId;
  } catch (e) {
    const message = formatLibtvAudioVoiceCloneError(
      e instanceof Error ? e.message : "克隆失败",
    );
    opts.updateNodeData(targetId, {
      runtime: {
        status: "error",
        failCode: "VOICE_CLONE",
        failMessage: message,
      },
    });
    throw e;
  }
}

/** 音频节点是否具备可克隆的 OSS/HTTPS 参考音 */
export function libtvAudioVoiceCloneSourceReady(data: {
  ossUrl?: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string };
}): string | undefined {
  const url =
    data.ossUrl?.trim() ||
    data.runtime?.ossUrl?.trim() ||
    data.runtime?.ephemeralUrl?.trim() ||
    "";
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
    return undefined;
  }
  if (!/^https?:\/\//i.test(url)) return undefined;
  return url;
}
