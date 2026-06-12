"use client";

import {
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
  STORY_PRO_OUTLINE_USER_PROMPT,
} from "./story-pro-prompts";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "./story-pro2-theme-outline-prompt";
import type { CanvasFlowEdge } from "./types";
import { selectPro2NodeAfterSpawn } from "./pro2-spawn-select";

export function buildPro2StarterNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    starterMode: "generate",
    themeInput: "",
    generatedOutlineMd: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    pipelineStage: "idle",
    ...overrides,
  };
}

export function buildPro2ScriptHubNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    outlineMd: "",
    characterMd: "",
    storyboardMd: "",
    providerId: "",
    modelKey: "",
    params: { ...STORY_PRO_LLM_PARAMS_DEFAULT },
    outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
    promptOutline: STORY_PRO_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_PRO2_CHARACTER_PROMPT,
    promptStoryboard: STORY_PRO2_STORYBOARD_PROMPT,
    dockInput: "",
    dockRefImages: [],
    ...overrides,
  };
}

export function buildPro2ImageNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    label: "图片",
    dockInput: "",
    ...overrides,
  };
}

export function buildPro2ThreeViewNodeData(
  overrides?: Record<string, unknown>,
): Record<string, unknown> {
  return {
    label: "角色",
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
  addNode: (
    type: "story-pro2-script-hub",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  setNodes: Parameters<typeof selectPro2NodeAfterSpawn>[0];
};

/** 从上游节点连出新的脚本 hub（每次新建，允许多条工作流） */
export function spawnPro2ScriptHubFromSource({
  sourceId,
  sourceHandle,
  targetHandle = "in_text",
  position,
  hubData,
  addNode,
  setEdges,
  setNodes,
}: SpawnScriptFromSourceArgs): string {
  const hubId = spawnPro2ScriptHubAt(addNode, position, hubData);
  if (!hubId) return "";
  setEdges((prev) => [
    ...prev,
    {
      id: `e-${sourceId}-${hubId}`,
      source: sourceId,
      target: hubId,
      sourceHandle,
      targetHandle,
    },
  ]);
  selectPro2NodeAfterSpawn(setNodes, hubId);
  return hubId;
}
