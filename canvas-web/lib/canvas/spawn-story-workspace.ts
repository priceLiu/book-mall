"use client";

import { nanoid } from "nanoid";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import {
  STORY_CHARACTER_ENGINE_PROMPT,
  STORY_OUTLINE_USER_PROMPT,
  STORY_STORYBOARD_ENGINE_PROMPT,
} from "./story-prompts";
import type { StoryWorkspaceIds } from "./story-workspace-types";

export type { StoryWorkspaceIds };

function connect(
  setEdges: (
    fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[],
  ) => void,
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

/** 启动节点是否已连到漫剧文案中枢 */
export function findStoryScriptHubForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  stored?: StoryWorkspaceIds | null,
): { scriptHubId: string } | null {
  if (stored?.scriptHubId) {
    const hub = nodes.find((n) => n.id === stored.scriptHubId);
    if (hub?.type === "story-script-hub") {
      return { scriptHubId: stored.scriptHubId };
    }
  }
  const hub = edges
    .filter((e) => e.source === starterNodeId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-script-hub");
  if (!hub) return null;
  return { scriptHubId: hub.id };
}

/** 完整四节点工作区（含媒体列，后续步骤启用） */
export function findStoryWorkspaceForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  stored?: StoryWorkspaceIds | null,
): StoryWorkspaceIds | null {
  const hubLink = findStoryScriptHubForStarter(
    nodes,
    edges,
    starterNodeId,
    stored,
  );
  if (!hubLink) return null;

  const hub = nodes.find((n) => n.id === hubLink.scriptHubId);
  if (!hub) return null;

  const charCol = edges
    .filter((e) => e.source === hub.id)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-character-column");
  const frameCol = charCol
    ? edges
        .filter((e) => e.source === charCol.id)
        .map((e) => nodes.find((n) => n.id === e.target))
        .find((n) => n?.type === "story-frame-column")
    : undefined;
  const videoCol = frameCol
    ? edges
        .filter((e) => e.source === frameCol.id)
        .map((e) => nodes.find((n) => n.id === e.target))
        .find((n) => n?.type === "story-video-column")
    : undefined;

  const ids: StoryWorkspaceIds = { scriptHubId: hubLink.scriptHubId };
  if (charCol) ids.characterColumnId = charCol.id;
  if (frameCol) ids.frameColumnId = frameCol.id;
  if (videoCol) ids.videoColumnId = videoCol.id;

  if (stored?.scriptHubId === hubLink.scriptHubId) {
    return { ...stored, ...ids };
  }
  return ids;
}

type SpawnHubArgs = {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: "story-script-hub",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

const LLM_PARAMS = {
  reasoning_effort: "low",
  max_tokens: 4000,
  temperature: 0.7,
};

/** 仅创建并连接「漫剧文案」节点（不创建角色/分镜/视频列） */
export function spawnStoryScriptHub(args: SpawnHubArgs): { scriptHubId: string } {
  const existing = findStoryScriptHubForStarter(
    args.nodes,
    args.edges,
    args.starterNodeId,
    (
      args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
        workspaceIds?: StoryWorkspaceIds;
      }
    )?.workspaceIds,
  );
  if (existing) {
    args.updateNodeData(args.starterNodeId, {
      workspaceIds: { scriptHubId: existing.scriptHubId },
    });
    syncStoryHubFromStarter({
      starterNodeId: args.starterNodeId,
      systemPrompt: args.systemPrompt,
      providerId: args.providerId,
      modelKey: args.modelKey,
      params: args.params,
      scriptHubId: existing.scriptHubId,
      updateNodeData: args.updateNodeData,
    });
    return existing;
  }

  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const base = starter?.position ?? { x: 80, y: 120 };
  const sharedLlm = {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: { ...LLM_PARAMS, ...args.params },
    referencedNodeIds: [args.starterNodeId],
  };

  const scriptHubId = args.addNode(
    "story-script-hub",
    { x: base.x + 480, y: base.y },
    {
      ...sharedLlm,
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      outlineSystemPrompt: args.systemPrompt.trim(),
      promptOutline: STORY_OUTLINE_USER_PROMPT,
      promptCharacter: STORY_CHARACTER_ENGINE_PROMPT,
      promptStoryboard: STORY_STORYBOARD_ENGINE_PROMPT,
    },
  );

  connect(args.setEdges, args.starterNodeId, scriptHubId, "text", "in_text");

  const ids: StoryWorkspaceIds = { scriptHubId };
  args.updateNodeData(args.starterNodeId, { workspaceIds: ids });

  syncStoryHubFromStarter({
    starterNodeId: args.starterNodeId,
    systemPrompt: args.systemPrompt,
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: args.params,
    scriptHubId,
    updateNodeData: args.updateNodeData,
  });

  return { scriptHubId };
}

type SpawnMediaArgs = SpawnHubArgs & {
  scriptHubId: string;
  addNode: (
    type:
      | "story-script-hub"
      | "story-character-column"
      | "story-frame-column"
      | "story-video-column",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
};

/** 从文案中枢向右输出：角色列 → 分镜列 → 视频列（及剪映连线） */
export function spawnStoryMediaColumns(
  args: SpawnMediaArgs,
): StoryWorkspaceIds {
  const existing = findStoryWorkspaceForStarter(
    args.nodes,
    args.edges,
    args.starterNodeId,
    (
      args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
        workspaceIds?: StoryWorkspaceIds;
      }
    )?.workspaceIds,
  );
  if (
    existing?.characterColumnId &&
    existing.frameColumnId &&
    existing.videoColumnId
  ) {
    args.updateNodeData(args.starterNodeId, {
      workspaceIds: {
        scriptHubId: args.scriptHubId,
        characterColumnId: existing.characterColumnId,
        frameColumnId: existing.frameColumnId,
        videoColumnId: existing.videoColumnId,
      },
    });
    return {
      scriptHubId: args.scriptHubId,
      characterColumnId: existing.characterColumnId,
      frameColumnId: existing.frameColumnId,
      videoColumnId: existing.videoColumnId,
    };
  }

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  const base = hub?.position ?? { x: 560, y: 120 };

  const characterColumnId =
    existing?.characterColumnId ??
    args.addNode(
      "story-character-column",
      { x: base.x + 560, y: base.y },
      { rows: [], hubNodeId: args.scriptHubId },
    );

  const frameColumnId =
    existing?.frameColumnId ??
    args.addNode(
      "story-frame-column",
      { x: base.x + 1120, y: base.y },
      { rows: [], hubNodeId: args.scriptHubId },
    );

  const videoColumnId =
    existing?.videoColumnId ??
    args.addNode(
      "story-video-column",
      { x: base.x + 1680, y: base.y },
      { rows: [], hubNodeId: args.scriptHubId, frameColumnId },
    );

  connect(args.setEdges, args.scriptHubId, characterColumnId, "text", "in_text");
  connect(args.setEdges, characterColumnId, frameColumnId, "text", "in_text");
  connect(args.setEdges, frameColumnId, videoColumnId, "text", "in_text");

  const exportNode = args.nodes.find((n) => n.type === "jianying-export");
  if (exportNode) {
    connect(args.setEdges, videoColumnId, exportNode.id, "text", "in_storyboard");
  }

  const ids: StoryWorkspaceIds = {
    scriptHubId: args.scriptHubId,
    characterColumnId,
    frameColumnId,
    videoColumnId,
  };
  args.updateNodeData(args.starterNodeId, { workspaceIds: ids });
  args.updateNodeData(characterColumnId, { hubNodeId: args.scriptHubId });
  args.updateNodeData(frameColumnId, { hubNodeId: args.scriptHubId });
  args.updateNodeData(videoColumnId, {
    hubNodeId: args.scriptHubId,
    frameColumnId,
  });

  return ids;
}

/** @deprecated 后续步骤再扩展媒体列；当前等同 spawnStoryScriptHub */
export function spawnStoryComicWorkspace(
  args: SpawnHubArgs & {
    addNode: (
      type:
        | "story-script-hub"
        | "story-character-column"
        | "story-frame-column"
        | "story-video-column",
      position: { x: number; y: number },
      data: Record<string, unknown>,
    ) => string;
  },
): StoryWorkspaceIds {
  const { scriptHubId } = spawnStoryScriptHub(args);
  return { scriptHubId };
}

export const STORY_HUB_SECTION_ORDER = [
  "outline",
  "character",
  "storyboard",
] as const;

export function storyHubSectionNodeRuns(
  hubId: string,
  sections: readonly ("outline" | "character" | "storyboard")[],
): Array<{ nodeId: string; llmSection: "outline" | "character" | "storyboard" }> {
  return sections.map((llmSection) => ({ nodeId: hubId, llmSection }));
}

export function syncStoryHubFromStarter(args: {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  scriptHubId: string;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}) {
  const shared = {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: { ...LLM_PARAMS, ...args.params },
    referencedNodeIds: [args.starterNodeId],
  };
  args.updateNodeData(args.scriptHubId, {
    ...shared,
    outlineSystemPrompt: args.systemPrompt.trim(),
    promptOutline: STORY_OUTLINE_USER_PROMPT,
    promptCharacter: STORY_CHARACTER_ENGINE_PROMPT,
    promptStoryboard: STORY_STORYBOARD_ENGINE_PROMPT,
  });
}
