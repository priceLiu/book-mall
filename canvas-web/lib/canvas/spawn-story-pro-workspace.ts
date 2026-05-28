"use client";

import { nanoid } from "nanoid";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import {
  STORY_PRO_CHARACTER_PROMPT,
  STORY_PRO_OUTLINE_USER_PROMPT,
  STORY_PRO_STORYBOARD_PROMPT,
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
  STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT,
} from "./story-pro-prompts";
import type { StoryProWorkspaceIds } from "./story-pro-workspace-types";
import { STORY_WORKSPACE_COL_H_GAP } from "./story-comic-workspace-layout";
import {
  storyControlRowBottom,
  storyMediaColumnY,
} from "./story-workspace-layout";
import { storyProControlRowX, storyProMediaColumnStartX } from "./story-pro-control-layout";

export type { StoryProWorkspaceIds };

function connect(
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void,
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
      { id: `e-${nanoid(6)}`, source, target, sourceHandle, targetHandle },
    ];
  });
}

function belongsToHub(node: CanvasFlowNode, scriptHubId: string): boolean {
  const hubNodeId = (node.data as { hubNodeId?: string }).hubNodeId;
  if (hubNodeId) return hubNodeId === scriptHubId;
  return true;
}

type ProAddNode = (
  type:
    | "story-pro-script-hub"
    | "story-pro-style"
    | "story-pro-character"
    | "story-pro-scene"
    | "story-pro-frame"
    | "story-pro-video"
    | "jianying-export-pro",
  position: { x: number; y: number },
  data: Record<string, unknown>,
) => string;

export function findStoryProScriptHubForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  stored?: StoryProWorkspaceIds | null,
): { scriptHubId: string } | null {
  if (stored?.scriptHubId) {
    const hub = nodes.find((n) => n.id === stored.scriptHubId);
    if (hub?.type === "story-pro-script-hub") {
      return { scriptHubId: stored.scriptHubId };
    }
  }
  const hub = edges
    .filter((e) => e.source === starterNodeId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-pro-script-hub");
  if (!hub) return null;
  return { scriptHubId: hub.id };
}

export function findStoryProWorkspaceForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  stored?: StoryProWorkspaceIds | null,
): StoryProWorkspaceIds | null {
  const hubLink = findStoryProScriptHubForStarter(
    nodes,
    edges,
    starterNodeId,
    stored,
  );
  if (!hubLink) return null;

  const walk = (fromId: string, expectedType: CanvasFlowNode["type"]) =>
    edges
      .filter((e) => e.source === fromId)
      .map((e) => nodes.find((n) => n.id === e.target))
      .find((n) => n?.type === expectedType);

  const hub = nodes.find((n) => n.id === hubLink.scriptHubId);
  if (!hub) return null;

  const style = walk(hub.id, "story-pro-style");
  const charCol = style
    ? walk(style.id, "story-pro-character")
    : walk(hub.id, "story-pro-character");
  const sceneCol = charCol
    ? walk(charCol.id, "story-pro-scene")
    : undefined;
  const frameCol = sceneCol
    ? walk(sceneCol.id, "story-pro-frame")
    : charCol
      ? walk(charCol.id, "story-pro-frame")
      : undefined;
  const videoCol = frameCol
    ? walk(frameCol.id, "story-pro-video")
    : undefined;

  const ids: StoryProWorkspaceIds = { scriptHubId: hubLink.scriptHubId };
  if (style) ids.styleNodeId = style.id;
  if (charCol) ids.characterColumnId = charCol.id;
  if (sceneCol) ids.sceneColumnId = sceneCol.id;
  if (frameCol) ids.frameColumnId = frameCol.id;
  if (videoCol) ids.videoColumnId = videoCol.id;

  if (stored?.scriptHubId === hubLink.scriptHubId) {
    for (const key of [
      "styleNodeId",
      "characterColumnId",
      "sceneColumnId",
      "frameColumnId",
      "videoColumnId",
      "jianyingExportId",
    ] as const) {
      if (ids[key]) continue;
      const sid = stored[key];
      if (!sid) continue;
      const node = nodes.find((n) => n.id === sid);
      if (!node || !belongsToHub(node, hubLink.scriptHubId)) continue;
      ids[key] = sid;
    }
  }
  return ids;
}

const LLM_PARAMS = STORY_PRO_LLM_PARAMS_DEFAULT;

type SpawnProHubArgs = {
  starterNodeId: string;
  systemPrompt: string;
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: ProAddNode;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
};

export function spawnStoryProScriptHub(args: SpawnProHubArgs): {
  scriptHubId: string;
} {
  const existing = findStoryProScriptHubForStarter(
    args.nodes,
    args.edges,
    args.starterNodeId,
    (
      args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
        workspaceIds?: StoryProWorkspaceIds;
      }
    )?.workspaceIds,
  );
  if (existing) {
    args.updateNodeData(args.starterNodeId, {
      workspaceIds: { scriptHubId: existing.scriptHubId },
    });
    return existing;
  }

  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const base = starter?.position ?? { x: 80, y: 120 };
  const { hubX } = storyProControlRowX(base.x);
  const sharedLlm = {
    providerId: args.providerId,
    modelKey: args.modelKey,
    params: { ...LLM_PARAMS, ...args.params },
    referencedNodeIds: [args.starterNodeId],
  };

  const scriptHubId = args.addNode(
    "story-pro-script-hub",
    { x: hubX, y: base.y },
    {
      ...sharedLlm,
      outlineMd: "",
      characterMd: "",
      storyboardMd: "",
      outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
      promptOutline: STORY_PRO_OUTLINE_USER_PROMPT,
      promptCharacter: STORY_PRO_CHARACTER_PROMPT,
      promptStoryboard: STORY_PRO_STORYBOARD_PROMPT,
    },
  );

  connect(args.setEdges, args.starterNodeId, scriptHubId, "text", "in_text");
  args.updateNodeData(args.starterNodeId, {
    workspaceIds: { scriptHubId },
  });
  return { scriptHubId };
}

export function spawnStoryProStyleNode(
  args: SpawnProHubArgs & { scriptHubId: string },
): string {
  const existing = args.nodes.find(
    (n) =>
      n.type === "story-pro-style" &&
      belongsToHub(n, args.scriptHubId),
  );
  if (existing) return existing.id;

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const originX = starter?.position.x ?? hub?.position.x ?? 80;
  const { styleX } = storyProControlRowX(originX);
  const styleId = args.addNode(
    "story-pro-style",
    { x: styleX, y: hub?.position.y ?? 120 },
    {
      hubNodeId: args.scriptHubId,
      styleAnchorZh: "",
      styleAnchorEn: "",
      negativePrompt: "",
      refImages: [],
      providerId: args.providerId,
      modelKey: args.modelKey,
      params: { ...LLM_PARAMS, ...args.params },
    },
  );
  connect(args.setEdges, args.scriptHubId, styleId, "text", "in_text");
  const ws =
    (
      args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
        workspaceIds?: StoryProWorkspaceIds;
      }
    ).workspaceIds ?? { scriptHubId: args.scriptHubId };
  args.updateNodeData(args.starterNodeId, {
    workspaceIds: { ...ws, scriptHubId: args.scriptHubId, styleNodeId: styleId },
  });
  return styleId;
}

function proMediaColumnXs(styleLeftX: number): [number, number, number, number, number] {
  const wChar = NODE_DEFAULT_SIZE["story-pro-character"].width;
  const wScene = NODE_DEFAULT_SIZE["story-pro-scene"].width;
  const wFrame = NODE_DEFAULT_SIZE["story-pro-frame"].width;
  const wVideo = NODE_DEFAULT_SIZE["story-pro-video"].width;
  const gap = STORY_WORKSPACE_COL_H_GAP;
  const x0 = storyProMediaColumnStartX(styleLeftX);
  return [
    x0,
    x0 + wChar + gap,
    x0 + wChar + gap + wScene + gap,
    x0 + wChar + gap + wScene + gap + wFrame + gap,
    x0 + wChar + gap + wScene + gap + wFrame + gap + wVideo + gap,
  ];
}

export function spawnStoryProMediaColumns(
  args: SpawnProHubArgs & { scriptHubId: string },
): StoryProWorkspaceIds {
  const styleId = spawnStoryProStyleNode(args);
  const style = args.nodes.find((n) => n.id === styleId) ?? {
    position: { x: 1040, y: 120 },
  };
  const originY = style.position?.y ?? 120;
  const hubLeftX = style.position?.x ?? 1040;
  const rowBottom = storyControlRowBottom(originY);
  const [charX, sceneX, frameX, videoX, exportX] = proMediaColumnXs(hubLeftX);

  const characterColumnId = args.addNode(
    "story-pro-character",
    { x: charX, y: storyMediaColumnY(originY, rowBottom, "story-pro-character") },
    { rows: [], hubNodeId: args.scriptHubId },
  );
  const sceneColumnId = args.addNode(
    "story-pro-scene",
    { x: sceneX, y: storyMediaColumnY(originY, rowBottom, "story-pro-scene") },
    { rows: [], hubNodeId: args.scriptHubId },
  );
  const frameColumnId = args.addNode(
    "story-pro-frame",
    { x: frameX, y: storyMediaColumnY(originY, rowBottom, "story-pro-frame") },
    { rows: [], hubNodeId: args.scriptHubId },
  );
  const videoColumnId = args.addNode(
    "story-pro-video",
    { x: videoX, y: storyMediaColumnY(originY, rowBottom, "story-pro-video") },
    { rows: [], hubNodeId: args.scriptHubId, frameColumnId },
  );
  const jianyingExportId = args.addNode(
    "jianying-export-pro",
    { x: exportX, y: storyMediaColumnY(originY, rowBottom, "jianying-export-pro") },
    { label: "剪映导出 · 专业版", hubNodeId: args.scriptHubId },
  );

  connect(args.setEdges, styleId, characterColumnId, "text", "in_text");
  connect(args.setEdges, characterColumnId, sceneColumnId, "text", "in_text");
  connect(args.setEdges, sceneColumnId, frameColumnId, "text", "in_text");
  connect(args.setEdges, frameColumnId, videoColumnId, "text", "in_text");
  connect(args.setEdges, videoColumnId, jianyingExportId, "text", "in_storyboard");

  const ids: StoryProWorkspaceIds = {
    scriptHubId: args.scriptHubId,
    styleNodeId: styleId,
    characterColumnId,
    sceneColumnId,
    frameColumnId,
    videoColumnId,
    jianyingExportId,
  };
  args.updateNodeData(args.starterNodeId, { workspaceIds: ids });
  return ids;
}

export function storyProHubHasOutputWorkflow(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): boolean {
  return storyProHubHasMediaColumns(nodes, scriptHubId);
}

/** 风格定稿后 spawn 的任一媒体/导出列仍存在 */
export function storyProHubHasMediaColumns(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): boolean {
  return nodes.some(
    (n) =>
      (n.type === "story-pro-character" ||
        n.type === "story-pro-scene" ||
        n.type === "story-pro-frame" ||
        n.type === "story-pro-video" ||
        n.type === "jianying-export-pro") &&
      belongsToHub(n, scriptHubId),
  );
}

/** 故事剧本已定稿并进入风格层（专业版：仅有风格节点、尚无媒体列也算定稿） */
export function storyProHubHasStyleLayer(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): boolean {
  return nodes.some(
    (n) => n.type === "story-pro-style" && belongsToHub(n, scriptHubId),
  );
}

export function reconcileStoryProHubFinalized(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "story-pro-script-hub") return n;
    const d = n.data as { scriptFinalized?: boolean };
    const hasStyle = storyProHubHasStyleLayer(nodes, n.id);
    const hasMedia = storyProHubHasMediaColumns(nodes, n.id);

    // 修复旧逻辑误清：已有风格节点即视为故事已定稿
    if (!d.scriptFinalized && hasStyle && !hasMedia) {
      return { ...n, data: { ...n.data, scriptFinalized: true } };
    }

    if (!d.scriptFinalized) return n;
    if (hasMedia || hasStyle) return n;
    return { ...n, data: { ...n.data, scriptFinalized: false } };
  });
}

/** 删下游列后解除风格定稿，允许再次「风格定稿 · 生成工作流」 */
export function reconcileStoryProStyleFinalized(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  let next = nodes;
  for (const styleNode of nodes) {
    if (styleNode.type !== "story-pro-style") continue;
    const d = styleNode.data as { styleFinalized?: boolean; hubNodeId?: string };
    if (!d.styleFinalized) continue;
    const hubId = d.hubNodeId;
    if (!hubId) continue;
    if (storyProHubHasMediaColumns(next, hubId)) continue;

    next = next.map((n) =>
      n.id === styleNode.id
        ? { ...n, data: { ...n.data, styleFinalized: false } }
        : n,
    );
    next = next.map((n) => {
      if (n.type !== "story-pro-starter") return n;
      const ws = (n.data as { workspaceIds?: StoryProWorkspaceIds })
        .workspaceIds;
      if (ws?.scriptHubId !== hubId) return n;
      const stage = (n.data as { pipelineStage?: string }).pipelineStage;
      if (stage === "style_finalized" || stage === "finalized") {
        return {
          ...n,
          data: { ...n.data, pipelineStage: "script_finalized" },
        };
      }
      return n;
    });
  }
  return next;
}

/** hydrate / 删节点 / reflow 后统一校正 story-pro 定稿状态 */
export function reconcileStoryProWorkspace(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return reconcileStoryProStyleFinalized(reconcileStoryProHubFinalized(nodes));
}

export const STORY_PRO_HUB_SECTION_ORDER = [
  "outline",
  "character",
  "storyboard",
] as const;

export const STORY_PRO_DEFAULT_SYSTEM_PROMPT = STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT;
