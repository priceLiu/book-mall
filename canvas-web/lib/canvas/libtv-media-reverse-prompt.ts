"use client";

import { nanoid } from "nanoid";
import type { CanvasProviderDto } from "@/lib/canvas-providers-api";
import { buildStoryLlmDockParams } from "@/lib/canvas/story-llm-dock-params";
import { busEnqueueStoryRun } from "./canvas-run-bus";
import { resolveLibtvDockEngineModel } from "./libtv-dock-engine-models";
import { LIBTV_SQUARE_IMAGE_NODE_WIDTH } from "./libtv-node-chrome";
import { libtvNodeHttpsMediaUrlForLlm } from "./pro2-starter-dock-send";
import { buildPro2GeneralTextNodeData } from "./pro2-spawn-nodes";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { PRO2_TEXT_NODE_WIDTH } from "./story-pro2-node-chrome";
import { STORY_PRO_LLM_PARAMS_DEFAULT } from "./story-pro-prompts";
import { SBV1_VIDEO_ENGINE_WIDTH } from "./sbv1-node-chrome";
import { pickStoryQwen38MaxLlmEngine } from "./system-providers";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

const GAP = 56;

export type LibtvMediaReversePromptFailure =
  | "missing_node"
  | "unsupported_type"
  | "no_https_media"
  | "no_model"
  | "spawn_failed"
  | "queue_failed";

export type LibtvMediaReversePromptResult =
  | { ok: true; textNodeId: string }
  | { ok: false; reason: LibtvMediaReversePromptFailure };

export type LibtvMediaReversePromptStore = {
  nodes: CanvasFlowNode[];
  addNode: (
    type: "story-pro2-starter",
    position: { x: number; y: number },
    data?: Record<string, unknown>,
  ) => string;
  setNodes: (fn: (nodes: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
  setEdges: (fn: (edges: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

function reversePromptPresetForNode(
  node: CanvasFlowNode,
): "image-to-prompt" | "video-to-prompt" | null {
  if (
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view" ||
    node.type === "sbv1-image"
  ) {
    return "image-to-prompt";
  }
  if (node.type === "sbv1-video-engine" || node.type === "video-engine") {
    return "video-to-prompt";
  }
  return null;
}

function sourceHandleForPreset(
  preset: "image-to-prompt" | "video-to-prompt",
): string {
  return preset === "video-to-prompt" ? "out_video" : "image";
}

function anchorWidth(node: CanvasFlowNode, preset: "image-to-prompt" | "video-to-prompt"): number {
  if (preset === "video-to-prompt") {
    return node.width ?? SBV1_VIDEO_ENGINE_WIDTH;
  }
  return node.width ?? LIBTV_SQUARE_IMAGE_NODE_WIDTH;
}

/** 媒体节点顶栏 · 反推提示词：右侧建文本节点、连线、Qwen3.8 Max 入队生成 */
export function runLibtvMediaReversePromptFromNode(
  sourceNodeId: string,
  store: LibtvMediaReversePromptStore,
  providers: CanvasProviderDto[],
): LibtvMediaReversePromptResult {
  const anchor = store.nodes.find((n) => n.id === sourceNodeId);
  if (!anchor) return { ok: false, reason: "missing_node" };

  const preset = reversePromptPresetForNode(anchor);
  if (!preset) return { ok: false, reason: "unsupported_type" };

  if (!libtvNodeHttpsMediaUrlForLlm(anchor)) {
    return { ok: false, reason: "no_https_media" };
  }

  const engine = pickStoryQwen38MaxLlmEngine(providers);

  const model = resolveLibtvDockEngineModel(
    providers,
    engine.providerId,
    engine.modelKey,
  );
  const params = model
    ? buildStoryLlmDockParams(model, {})
    : { ...STORY_PRO_LLM_PARAMS_DEFAULT };

  const anchorW = anchorWidth(anchor, preset);
  const textId = store.addNode(
    "story-pro2-starter",
    {
      x: anchor.position.x + anchorW + GAP,
      y: anchor.position.y,
    },
    buildPro2GeneralTextNodeData({
      pro2PresetKind: preset,
      pro2TextPurpose: "general",
      providerId: engine.providerId,
      modelKey: engine.modelKey,
      params,
      themeInput: "",
      themeOutlineRuntime: {
        status: "pending",
        taskId: undefined,
        failCode: undefined,
        failMessage: undefined,
        dismissedFailTaskId: undefined,
      },
    }),
  );
  if (!textId) return { ok: false, reason: "spawn_failed" };

  store.setEdges((prev) => [
    ...prev,
    {
      id: `e-${nanoid(6)}`,
      source: sourceNodeId,
      target: textId,
      sourceHandle: sourceHandleForPreset(preset),
      targetHandle: "in_text",
    },
  ]);

  selectPro2NodeAfterSpawn(store.setNodes, textId);

  const queued = busEnqueueStoryRun({
    nodeId: textId,
    mediaKind: "generalText",
    forceFresh: true,
  });
  if (!queued) {
    store.updateNodeData(textId, {
      themeOutlineRuntime: {
        status: "error",
        failCode: "RUN_QUEUE_BUSY",
        failMessage: "生成任务未能入队，请稍候再试。",
      },
    });
    return { ok: false, reason: "queue_failed" };
  }

  return { ok: true, textNodeId: textId };
}

export function libtvMediaReversePromptFailureMessage(
  reason: LibtvMediaReversePromptFailure,
): { title: string; message: string } {
  switch (reason) {
    case "no_https_media":
      return {
        title: "暂无法反推",
        message:
          "需要已上传至云端的图片或视频（HTTPS 地址）。若刚上传，请等待上传完成后再试。",
      };
    case "no_model":
      return {
        title: "模型不可用",
        message:
          "未找到 Qwen3.8 Max（qwen3.8-max）Gateway 登记。请在 Gateway 模型管理页确认已上架并绑定凭证。",
      };
    case "queue_failed":
      return {
        title: "生成未能开始",
        message: "任务队列繁忙，请稍候再试。",
      };
    case "unsupported_type":
      return {
        title: "不支持反推",
        message: "当前节点类型不支持从此入口反推提示词。",
      };
    default:
      return {
        title: "反推失败",
        message: "请刷新画布后重试。",
      };
  }
}
