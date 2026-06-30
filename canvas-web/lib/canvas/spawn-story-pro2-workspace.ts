"use client";

import { nanoid } from "nanoid";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import {
  STORY_PRO_HUB_LLM_SYSTEM,
  STORY_PRO_LLM_PARAMS_DEFAULT,
  STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT,
} from "./story-pro-prompts";
import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_PACK_PROMPT_VERSION,
  STORY_PRO2_SCENE_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "./story-pro2-theme-outline-prompt";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import { STORY_WORKSPACE_COL_H_GAP } from "./story-comic-workspace-layout";
import {
  storyControlRowBottom,
  storyMediaColumnY,
} from "./story-workspace-layout";
import { storyProControlRowX, storyProMediaColumnStartX } from "./story-pro-control-layout";

export type { StoryPro2WorkspaceIds };

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
    | "story-pro2-script-hub"
    | "story-pro2-style"
    | "story-pro2-character"
    | "story-pro2-scene"
    | "story-pro2-frame"
    | "story-pro2-video"
    | "jianying-export-pro2",
  position: { x: number; y: number },
  data: Record<string, unknown>,
) => string;

export function findStoryPro2ScriptHubForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  stored?: { scriptHubId?: string } | StoryPro2WorkspaceIds | null,
): { scriptHubId: string } | null {
  if (stored?.scriptHubId) {
    const hub = nodes.find((n) => n.id === stored.scriptHubId);
    if (hub?.type === "story-pro2-script-hub") {
      return { scriptHubId: stored.scriptHubId };
    }
  }
  const hub = edges
    .filter((e) => e.source === starterNodeId)
    .map((e) => nodes.find((n) => n.id === e.target))
    .find((n) => n?.type === "story-pro2-script-hub");
  if (!hub) return null;
  return { scriptHubId: hub.id };
}

export function findStoryPro2WorkspaceForStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  starterNodeId: string,
  stored?: StoryPro2WorkspaceIds | null,
): StoryPro2WorkspaceIds | null {
  const hubLink = findStoryPro2ScriptHubForStarter(
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

  const style = walk(hub.id, "story-pro2-style");
  const charCol = style
    ? walk(style.id, "story-pro2-character")
    : walk(hub.id, "story-pro2-character");
  const sceneCol = charCol
    ? walk(charCol.id, "story-pro2-scene")
    : undefined;
  const frameCol = sceneCol
    ? walk(sceneCol.id, "story-pro2-frame")
    : charCol
      ? walk(charCol.id, "story-pro2-frame")
      : undefined;
  const videoCol = frameCol
    ? walk(frameCol.id, "story-pro2-video")
    : undefined;

  const ids: StoryPro2WorkspaceIds = { scriptHubId: hubLink.scriptHubId };
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

/** 从 story-pro2-script-hub 解析工作区列 ID（不依赖 story-pro2-starter） */
export function findStoryPro2WorkspaceFromHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
): StoryPro2WorkspaceIds | null {
  const hub = nodes.find((n) => n.id === scriptHubId);
  if (!hub || hub.type !== "story-pro2-script-hub") return null;

  const walk = (fromId: string, expectedType: CanvasFlowNode["type"]) =>
    edges
      .filter((e) => e.source === fromId)
      .map((e) => nodes.find((n) => n.id === e.target))
      .find((n) => n?.type === expectedType);

  const style = walk(hub.id, "story-pro2-style");
  const charCol = style
    ? walk(style.id, "story-pro2-character")
    : walk(hub.id, "story-pro2-character");
  const sceneCol = charCol ? walk(charCol.id, "story-pro2-scene") : undefined;
  const frameCol = sceneCol
    ? walk(sceneCol.id, "story-pro2-frame")
    : charCol
      ? walk(charCol.id, "story-pro2-frame")
      : undefined;
  const videoCol = frameCol ? walk(frameCol.id, "story-pro2-video") : undefined;

  const ids: StoryPro2WorkspaceIds = { scriptHubId };
  if (style) ids.styleNodeId = style.id;
  if (charCol) ids.characterColumnId = charCol.id;
  if (sceneCol) ids.sceneColumnId = sceneCol.id;
  if (frameCol) ids.frameColumnId = frameCol.id;
  if (videoCol) ids.videoColumnId = videoCol.id;
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

export function spawnStoryPro2ScriptHub(args: SpawnProHubArgs): {
  scriptHubId: string;
} {
  const existing = findStoryPro2ScriptHubForStarter(
    args.nodes,
    args.edges,
    args.starterNodeId,
    (
      args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
        workspaceIds?: StoryPro2WorkspaceIds;
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
    "story-pro2-script-hub",
    { x: hubX, y: base.y },
    {
      ...sharedLlm,
      outlineMd: "",
      characterMd: "",
      sceneMd: "",
      storyboardMd: "",
      outlineSystemPrompt: STORY_PRO_HUB_LLM_SYSTEM,
      promptOutline: STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
      promptCharacter: STORY_PRO2_CHARACTER_PROMPT,
      promptScene: STORY_PRO2_SCENE_PROMPT,
      promptStoryboard: STORY_PRO2_STORYBOARD_PROMPT,
      storyPro2PackPromptVersion: STORY_PRO2_PACK_PROMPT_VERSION,
    },
  );

  connect(args.setEdges, args.starterNodeId, scriptHubId, "text", "in_text");
  args.updateNodeData(args.starterNodeId, {
    workspaceIds: { scriptHubId },
  });
  return { scriptHubId };
}

/** 2.0 LibTV · 从脚本节点左侧 spawn 人物设计列 */
export function spawnStoryPro2CharacterColumnFromHub(args: {
  scriptHubId: string;
  starterNodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: "story-pro2-character",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): string {
  const ws = (
    args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
      workspaceIds?: StoryPro2WorkspaceIds;
    }
  )?.workspaceIds;
  if (ws?.characterColumnId) {
    const existing = args.nodes.find((n) => n.id === ws.characterColumnId);
    if (existing?.type === "story-pro2-character") return existing.id;
  }

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  if (!hub) throw new Error("找不到脚本节点");

  const gap = 56;
  const charW = NODE_DEFAULT_SIZE["story-pro2-character"].width;
  const characterColumnId = args.addNode(
    "story-pro2-character",
    {
      x: (hub.position?.x ?? 0) - charW - gap,
      y: hub.position?.y ?? 120,
    },
    { rows: [], hubNodeId: args.scriptHubId },
  );

  connect(
    args.setEdges,
    args.scriptHubId,
    characterColumnId,
    "text",
    "in_text",
  );

  const nextWs: StoryPro2WorkspaceIds = {
    ...(ws ?? { scriptHubId: args.scriptHubId }),
    scriptHubId: args.scriptHubId,
    characterColumnId,
  };
  args.updateNodeData(args.starterNodeId, { workspaceIds: nextWs });
  return characterColumnId;
}

/** 2.0 LibTV · 从脚本节点 spawn 场景设计列 */
export function spawnStoryPro2SceneColumnFromHub(args: {
  scriptHubId: string;
  starterNodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: "story-pro2-scene",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): string {
  const ws = (
    args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
      workspaceIds?: StoryPro2WorkspaceIds;
    }
  )?.workspaceIds;
  if (ws?.sceneColumnId) {
    const existing = args.nodes.find((n) => n.id === ws.sceneColumnId);
    if (existing?.type === "story-pro2-scene") return existing.id;
  }

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  if (!hub) throw new Error("找不到脚本节点");

  const gap = 56;
  const sceneW = NODE_DEFAULT_SIZE["story-pro2-scene"].width;
  const charCol = ws?.characterColumnId
    ? args.nodes.find((n) => n.id === ws.characterColumnId)
    : undefined;

  let x: number;
  let y: number;
  if (charCol) {
    const charW =
      charCol.width ?? NODE_DEFAULT_SIZE["story-pro2-character"].width;
    x = (charCol.position?.x ?? 0) - sceneW - gap;
    y = charCol.position?.y ?? hub.position?.y ?? 120;
  } else {
    x = (hub.position?.x ?? 0) - sceneW - gap;
    y = hub.position?.y ?? 120;
  }

  const sceneColumnId = args.addNode(
    "story-pro2-scene",
    { x, y },
    { rows: [], hubNodeId: args.scriptHubId },
  );

  connect(args.setEdges, args.scriptHubId, sceneColumnId, "text", "in_text");
  if (charCol) {
    connect(args.setEdges, charCol.id, sceneColumnId, "text", "in_text");
  }

  const nextWs: StoryPro2WorkspaceIds = {
    ...(ws ?? { scriptHubId: args.scriptHubId }),
    scriptHubId: args.scriptHubId,
    sceneColumnId,
  };
  args.updateNodeData(args.starterNodeId, { workspaceIds: nextWs });
  return sceneColumnId;
}

/** 2.0 LibTV · 从脚本节点右侧 spawn 分镜图列（不经过风格层） */
export function spawnStoryPro2FrameColumnFromHub(args: {
  scriptHubId: string;
  starterNodeId: string;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: "story-pro2-frame",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
}): string {
  const ws = (
    args.nodes.find((n) => n.id === args.starterNodeId)?.data as {
      workspaceIds?: StoryPro2WorkspaceIds;
    }
  )?.workspaceIds;
  if (ws?.frameColumnId) {
    const existing = args.nodes.find((n) => n.id === ws.frameColumnId);
    if (existing?.type === "story-pro2-frame") return existing.id;
  }

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  if (!hub) throw new Error("找不到脚本节点");

  const gap = 56;
  const hubW = hub.width ?? NODE_DEFAULT_SIZE["story-pro2-script-hub"].width;
  const frameColumnId = args.addNode(
    "story-pro2-frame",
    {
      x: (hub.position?.x ?? 0) + hubW + gap,
      y: hub.position?.y ?? 120,
    },
    { rows: [], hubNodeId: args.scriptHubId },
  );

  connect(
    args.setEdges,
    args.scriptHubId,
    frameColumnId,
    "text",
    "in_text",
  );

  const nextWs: StoryPro2WorkspaceIds = {
    ...(ws ?? { scriptHubId: args.scriptHubId }),
    scriptHubId: args.scriptHubId,
    frameColumnId,
  };
  args.updateNodeData(args.starterNodeId, { workspaceIds: nextWs });
  return frameColumnId;
}

export function spawnStoryPro2StyleNode(
  args: SpawnProHubArgs & { scriptHubId: string },
): string {
  const existing = args.nodes.find(
    (n) =>
      n.type === "story-pro2-style" &&
      belongsToHub(n, args.scriptHubId),
  );
  if (existing) return existing.id;

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const originX = starter?.position.x ?? hub?.position.x ?? 80;
  const { styleX } = storyProControlRowX(originX);
  const styleId = args.addNode(
    "story-pro2-style",
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
        workspaceIds?: StoryPro2WorkspaceIds;
      }
    ).workspaceIds ?? { scriptHubId: args.scriptHubId };
  args.updateNodeData(args.starterNodeId, {
    workspaceIds: { ...ws, scriptHubId: args.scriptHubId, styleNodeId: styleId },
  });
  return styleId;
}

function proMediaColumnXs(styleLeftX: number): [number, number, number, number, number] {
  const wChar = NODE_DEFAULT_SIZE["story-pro2-character"].width;
  const wScene = NODE_DEFAULT_SIZE["story-pro2-scene"].width;
  const wFrame = NODE_DEFAULT_SIZE["story-pro2-frame"].width;
  const wVideo = NODE_DEFAULT_SIZE["story-pro2-video"].width;
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

export function spawnStoryPro2MediaColumns(
  args: SpawnProHubArgs & { scriptHubId: string },
): StoryPro2WorkspaceIds {
  const styleId = spawnStoryPro2StyleNode(args);
  const style = args.nodes.find((n) => n.id === styleId) ?? {
    position: { x: 1040, y: 120 },
  };
  const originY = style.position?.y ?? 120;
  const hubLeftX = style.position?.x ?? 1040;
  const rowBottom = storyControlRowBottom(originY);
  const [charX, sceneX, frameX, videoX, exportX] = proMediaColumnXs(hubLeftX);

  const characterColumnId = args.addNode(
    "story-pro2-character",
    { x: charX, y: storyMediaColumnY(originY, rowBottom, "story-pro2-character") },
    { rows: [], hubNodeId: args.scriptHubId },
  );
  const sceneColumnId = args.addNode(
    "story-pro2-scene",
    { x: sceneX, y: storyMediaColumnY(originY, rowBottom, "story-pro2-scene") },
    { rows: [], hubNodeId: args.scriptHubId },
  );
  const frameColumnId = args.addNode(
    "story-pro2-frame",
    { x: frameX, y: storyMediaColumnY(originY, rowBottom, "story-pro2-frame") },
    { rows: [], hubNodeId: args.scriptHubId },
  );
  const videoColumnId = args.addNode(
    "story-pro2-video",
    { x: videoX, y: storyMediaColumnY(originY, rowBottom, "story-pro2-video") },
    { rows: [], hubNodeId: args.scriptHubId, frameColumnId },
  );
  const jianyingExportId = args.addNode(
    "jianying-export-pro2",
    { x: exportX, y: storyMediaColumnY(originY, rowBottom, "jianying-export-pro2") },
    { label: "导出剪辑", hubNodeId: args.scriptHubId },
  );

  connect(args.setEdges, styleId, characterColumnId, "text", "in_text");
  connect(args.setEdges, characterColumnId, sceneColumnId, "text", "in_text");
  connect(args.setEdges, sceneColumnId, frameColumnId, "text", "in_text");
  connect(args.setEdges, frameColumnId, videoColumnId, "text", "in_text");
  connect(args.setEdges, videoColumnId, jianyingExportId, "text", "in_storyboard");

  const ids: StoryPro2WorkspaceIds = {
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

export function storyPro2HubHasOutputWorkflow(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): boolean {
  return storyPro2HubHasMediaColumns(nodes, scriptHubId);
}

/** 风格定稿后 spawn 的任一媒体/导出列仍存在 */
export function storyPro2HubHasMediaColumns(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): boolean {
  return nodes.some(
    (n) =>
      (n.type === "story-pro2-character" ||
        n.type === "story-pro2-scene" ||
        n.type === "story-pro2-frame" ||
        n.type === "story-pro2-video" ||
        n.type === "jianying-export-pro2") &&
      belongsToHub(n, scriptHubId),
  );
}

/** 故事剧本已定稿并进入风格层（专业版：仅有风格节点、尚无媒体列也算定稿） */
export function storyPro2HubHasStyleLayer(
  nodes: CanvasFlowNode[],
  scriptHubId: string,
): boolean {
  return nodes.some(
    (n) => n.type === "story-pro2-style" && belongsToHub(n, scriptHubId),
  );
}

export function reconcileStoryPro2HubFinalized(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "story-pro2-script-hub") return n;
    const d = n.data as { scriptFinalized?: boolean };
    const hasStyle = storyPro2HubHasStyleLayer(nodes, n.id);
    const hasMedia = storyPro2HubHasMediaColumns(nodes, n.id);

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
export function reconcileStoryPro2StyleFinalized(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  let next = nodes;
  for (const styleNode of nodes) {
    if (styleNode.type !== "story-pro2-style") continue;
    const d = styleNode.data as { styleFinalized?: boolean; hubNodeId?: string };
    if (!d.styleFinalized) continue;
    const hubId = d.hubNodeId;
    if (!hubId) continue;
    if (storyPro2HubHasMediaColumns(next, hubId)) continue;

    next = next.map((n) =>
      n.id === styleNode.id
        ? { ...n, data: { ...n.data, styleFinalized: false } }
        : n,
    );
    next = next.map((n) => {
      if (n.type !== "story-pro2-starter") return n;
      const ws = (n.data as { workspaceIds?: StoryPro2WorkspaceIds })
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
export function reconcileStoryPro2Workspace(
  nodes: CanvasFlowNode[],
): CanvasFlowNode[] {
  return reconcileStoryPro2StyleFinalized(reconcileStoryPro2HubFinalized(nodes));
}

export const STORY_PRO_HUB_SECTION_ORDER = [
  "outline",
  "character",
  "storyboard",
] as const;

export const STORY_PRO_DEFAULT_SYSTEM_PROMPT = STORY_PRO_THEME_SYSTEM_PROMPT_DEFAULT;
