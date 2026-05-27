"use client";

import { nanoid } from "nanoid";
import type { CanvasFlowEdge, CanvasFlowNode, StoryLlmEngineIds } from "./types";
import {
  STORY_CHARACTER_ENGINE_PROMPT,
  STORY_OUTLINE_LLM_PARAMS,
  STORY_OUTLINE_USER_PROMPT,
  STORY_STORYBOARD_ENGINE_PROMPT,
} from "./story-prompts";
import { spawnStoryComicColumnGroups } from "./story-comic-groups";

export type { StoryLlmEngineIds };

function verifyEngineIds(
  nodes: CanvasFlowNode[],
  ids: StoryLlmEngineIds,
): boolean {
  const outline = nodes.find((n) => n.id === ids.outlineId);
  const character = nodes.find((n) => n.id === ids.characterId);
  const storyboard = nodes.find((n) => n.id === ids.storyboardId);
  return (
    outline?.type === "story-outline-engine" &&
    character?.type === "character-engine" &&
    storyboard?.type === "storyboard-engine"
  );
}

/** 从启动节点连线拓扑解析三文案引擎（优先于全局 find）。 */
export function findStoryLlmEnginesForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  storedIds?: StoryLlmEngineIds | null,
): StoryLlmEngineIds | null {
  if (storedIds && verifyEngineIds(nodes, storedIds)) {
    return storedIds;
  }

  const outline = edges
    .filter((e) => e.source === starterNodeId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-outline-engine");
  if (!outline) return null;

  const outlineChildren = edges
    .filter((e) => e.source === outline.id)
    .map((e) => nodes.find((n) => n.id === e.target))
    .filter((n): n is CanvasFlowNode => Boolean(n));

  const character = outlineChildren.find((n) => n.type === "character-engine");
  let storyboard = outlineChildren.find((n) => n.type === "storyboard-engine");
  if (!storyboard && character) {
    storyboard = edges
      .filter((e) => e.source === character.id)
      .map((e) => nodes.find((n) => n.id === e.target))
      .find((n) => n?.type === "storyboard-engine");
  }

  if (!character || !storyboard) return null;
  return {
    outlineId: outline.id,
    characterId: character.id,
    storyboardId: storyboard.id,
  };
}

/** @deprecated 请用 findStoryLlmEnginesForStarter，避免多套引擎时 id 错位 */
export function findStoryLlmEngines(
  nodes: CanvasFlowNode[],
): StoryLlmEngineIds | null {
  const outline = nodes.find((n) => n.type === "story-outline-engine");
  const character = nodes.find((n) => n.type === "character-engine");
  const storyboard = nodes.find((n) => n.type === "storyboard-engine");
  if (!outline || !character || !storyboard) return null;
  return {
    outlineId: outline.id,
    characterId: character.id,
    storyboardId: storyboard.id,
  };
}

type SpawnArgs = {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type:
      | "story-outline-engine"
      | "character-engine"
      | "storyboard-engine"
      | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

function connect(
  setEdges: SpawnArgs["setEdges"],
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
) {
  setEdges((prev) => {
    if (prev.some((e) => e.source === source && e.target === target)) {
      return prev;
    }
    return [
      ...prev,
      {
        id: `e-${nanoid(6)}`,
        source,
        target,
        sourceHandle,
        targetHandle,
      },
    ];
  });
}

const LLM_PARAMS = { ...STORY_OUTLINE_LLM_PARAMS };

function persistStarterEngineIds(
  updateNodeData: SpawnArgs["updateNodeData"],
  starterNodeId: string,
  ids: StoryLlmEngineIds,
) {
  updateNodeData(starterNodeId, { llmEngineIds: ids });
}

/** 若尚无三文案引擎，则创建并连线；返回引擎 id（已有则直接返回）。 */
export function spawnStoryLlmEngines(args: SpawnArgs): StoryLlmEngineIds {
  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const storedIds = (
    starter?.data as { llmEngineIds?: StoryLlmEngineIds } | undefined
  )?.llmEngineIds;

  const existing = findStoryLlmEnginesForStarter(
    args.nodes,
    args.edges,
    args.starterNodeId,
    storedIds,
  );
  if (existing) {
    persistStarterEngineIds(args.updateNodeData, args.starterNodeId, existing);
    return existing;
  }

  const base = starter?.position ?? { x: 400, y: 200 };

  spawnStoryComicColumnGroups({
    starterNodeId: args.starterNodeId,
    nodes: args.nodes,
    addNode: (type, position, data) =>
      args.addNode(
        type as "story-outline-engine" | "character-engine" | "storyboard-engine" | "group",
        position,
        data,
      ),
  });

  const sharedEngine = {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: args.params,
    referencedNodeIds: [args.starterNodeId],
  };

  const outlineId = args.addNode(
    "story-outline-engine",
    { x: base.x + 400, y: base.y },
    {
      ...sharedEngine,
      outlineSystemPrompt: args.systemPrompt.trim(),
      prompt: STORY_OUTLINE_USER_PROMPT,
      params: { ...LLM_PARAMS, ...args.params },
    },
  );

  const characterId = args.addNode(
    "character-engine",
    { x: base.x + 400, y: base.y + 320 },
    {
      ...sharedEngine,
      prompt: STORY_CHARACTER_ENGINE_PROMPT,
      params: { ...LLM_PARAMS, ...args.params },
    },
  );

  const storyboardId = args.addNode(
    "storyboard-engine",
    { x: base.x + 400, y: base.y + 640 },
    {
      ...sharedEngine,
      prompt: STORY_STORYBOARD_ENGINE_PROMPT,
      params: { ...LLM_PARAMS, max_tokens: 6000, ...args.params },
    },
  );

  connect(args.setEdges, args.starterNodeId, outlineId, "text", "in_text");
  connect(args.setEdges, outlineId, characterId, "text", "in_text");
  connect(args.setEdges, outlineId, storyboardId, "text", "in_text");
  connect(args.setEdges, characterId, storyboardId, "text", "in_text");

  const exportNode = args.nodes.find((n) => n.type === "jianying-export");
  if (exportNode) {
    connect(args.setEdges, storyboardId, exportNode.id, "text", "in_storyboard");
  }

  const ids = { outlineId, characterId, storyboardId };
  persistStarterEngineIds(args.updateNodeData, args.starterNodeId, ids);
  return ids;
}

export const STORY_LLM_PIPELINE_ORDER: Array<
  keyof StoryLlmEngineIds
> = ["outlineId", "characterId", "storyboardId"];

export function storyLlmPipelineNodeIds(ids: StoryLlmEngineIds): string[] {
  return STORY_LLM_PIPELINE_ORDER.map((k) => ids[k]);
}

/** 漫剧启动重跑时，把 Provider / 主题同步到已存在的三文案引擎 */
export function syncStoryLlmEnginesFromStarter(args: {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  ids: StoryLlmEngineIds;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const shared = {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: { ...LLM_PARAMS, ...args.params },
    referencedNodeIds: [args.starterNodeId],
  };
  args.updateNodeData(args.ids.outlineId, {
    ...shared,
    outlineSystemPrompt: args.systemPrompt.trim(),
    prompt: STORY_OUTLINE_USER_PROMPT,
  });
  args.updateNodeData(args.ids.characterId, {
    ...shared,
    prompt: STORY_CHARACTER_ENGINE_PROMPT,
    params: { ...shared.params, max_tokens: 4000 },
  });
  args.updateNodeData(args.ids.storyboardId, {
    ...shared,
    prompt: STORY_STORYBOARD_ENGINE_PROMPT,
    params: { ...shared.params, max_tokens: 6000 },
  });
}
