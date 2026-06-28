"use client";

import { nanoid } from "nanoid";
import {
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
} from "./story-pro-prompts";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_PACK_PROMPT_VERSION,
  STORY_PRO2_SCENE_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "./story-pro2-theme-outline-prompt";
import { SBV1_DEFAULT_IMAGE_NODE_DATA } from "./sbv1-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";
import { findStoryPro2ScriptHubForStarter } from "./spawn-story-pro2-workspace";

export function buildPro2StarterNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    starterMode: "generate",
    themeInput: "",
    generatedOutlineMd: "",
    pro2TextPurpose: "general",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    pipelineStage: "idle",
    ...overrides,
  };
}

/** 文生图/生视频/反推等 · 不走故事大纲 LLM */
export function buildPro2GeneralTextNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return buildPro2StarterNodeData({
    pro2TextPurpose: "general",
    ...overrides,
  });
}

export function buildPro2ScriptHubNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    outlineMd: "",
    characterMd: "",
    sceneMd: "",
    storyboardMd: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
    promptOutline: STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
    promptCharacter: STORY_PRO2_CHARACTER_PROMPT,
    promptScene: STORY_PRO2_SCENE_PROMPT,
    promptStoryboard: STORY_PRO2_STORYBOARD_PROMPT,
    storyPro2PackPromptVersion: STORY_PRO2_PACK_PROMPT_VERSION,
    dockInput: "",
    dockRefImages: [],
    ...overrides,
  };
}

export function buildPro2ImageNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...SBV1_DEFAULT_IMAGE_NODE_DATA,
    pro2MediaRole: "generic",
    ...overrides,
  };
}

export function buildPro2ThreeViewNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...SBV1_DEFAULT_IMAGE_NODE_DATA,
    label: "角色",
    aspectRatio: "16:9",
    dockInput: "",
    ...overrides,
  };
}

/** 画布任意位置新建脚本节点（不合并已有 hub，支持多工作流并行） */
export function spawnPro2ScriptHubAt(
  addNode: (
    type: "story-pro2-script-hub",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string,
  position: { x: number; y: number },
  data?: Record<string, unknown>,
): string {
  return addNode("story-pro2-script-hub", position, buildPro2ScriptHubNodeData(data));
}

type SpawnScriptFromSourceArgs = {
  sourceId: string;
  sourceHandle: string;
  targetHandle?: string;
  position: { x: number; y: number };
  hubData?: Record<string, unknown>;
  nodes?: CanvasFlowNode[];
  edges?: CanvasFlowEdge[];
  updateNodeData?: (id: string, patch: Record<string, unknown>) => void;
  addNode: (
    type: "story-pro2-script-hub",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  setNodes: Parameters<typeof selectPro2NodeAfterSpawn>[0];
};

function connectScriptHubEdge(
  setEdges: SpawnScriptFromSourceArgs["setEdges"],
  sourceId: string,
  hubId: string,
  sourceHandle: string,
  targetHandle: string,
) {
  setEdges((prev) => {
    if (
      prev.some(
        (e) =>
          e.source === sourceId &&
          e.target === hubId &&
          e.sourceHandle === sourceHandle &&
          e.targetHandle === targetHandle,
      )
    ) {
      return prev;
    }
    return [
      ...prev,
      {
        id: `e-${nanoid(6)}`,
        source: sourceId,
        target: hubId,
        sourceHandle,
        targetHandle,
      },
    ];
  });
}

/** 从上游连出脚本 hub；文本节点已有关联 hub 时复用，避免重复空节点 */
export function spawnPro2ScriptHubFromSource({
  sourceId,
  sourceHandle,
  targetHandle = "in_text",
  position,
  hubData,
  nodes,
  edges,
  updateNodeData,
  addNode,
  setEdges,
  setNodes,
}: SpawnScriptFromSourceArgs): string {
  const source = nodes?.find((n) => n.id === sourceId);
  if (source?.type === "story-pro2-starter" && nodes && edges) {
    const workspaceIds = (
      source.data as { workspaceIds?: { scriptHubId?: string } }
    ).workspaceIds;
    const existing = findStoryPro2ScriptHubForStarter(
      nodes,
      edges,
      sourceId,
      workspaceIds,
    );
    if (existing) {
      if (hubData && updateNodeData) {
        updateNodeData(existing.scriptHubId, hubData);
      }
      connectScriptHubEdge(
        setEdges,
        sourceId,
        existing.scriptHubId,
        sourceHandle,
        targetHandle,
      );
      if (updateNodeData) {
        updateNodeData(sourceId, {
          workspaceIds: { scriptHubId: existing.scriptHubId },
        });
      }
      selectPro2NodeAfterSpawn(setNodes, existing.scriptHubId);
      return existing.scriptHubId;
    }
  }

  const hubId = spawnPro2ScriptHubAt(addNode, position, hubData);
  if (!hubId) return "";
  connectScriptHubEdge(setEdges, sourceId, hubId, sourceHandle, targetHandle);
  if (source?.type === "story-pro2-starter" && updateNodeData) {
    updateNodeData(sourceId, { workspaceIds: { scriptHubId: hubId } });
  }
  selectPro2NodeAfterSpawn(setNodes, hubId);
  return hubId;
}
