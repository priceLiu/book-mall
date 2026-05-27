"use client";

import { nanoid } from "nanoid";
import { nodeMeasuredSize } from "./normalize-graph-nodes";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import {
  STORY_CHARACTER_ENGINE_PROMPT,
  STORY_OUTLINE_LLM_PARAMS,
  STORY_OUTLINE_USER_PROMPT,
  STORY_STORYBOARD_ENGINE_PROMPT,
} from "./story-prompts";
import type { StoryWorkspaceIds } from "./story-workspace-types";
import { STORY_CONTROL_NODE_WIDTH } from "./story-node-chrome";
import { STORY_WORKSPACE_COL_H_GAP } from "./story-comic-workspace-layout";
import {
  storyControlRowBottom,
  storyMediaColumnXs,
  storyMediaColumnY,
} from "./story-workspace-layout";

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

const WORKSPACE_COLUMN_KEYS = [
  "characterColumnId",
  "frameColumnId",
  "videoColumnId",
  "jianyingExportId",
] as const;

function workspaceColumnType(
  key: (typeof WORKSPACE_COLUMN_KEYS)[number],
): CanvasFlowNode["type"] {
  if (key === "characterColumnId") return "story-character-column";
  if (key === "frameColumnId") return "story-frame-column";
  if (key === "videoColumnId") return "story-video-column";
  return "jianying-export";
}

function workspaceNodeBelongsToHub(
  node: CanvasFlowNode,
  scriptHubId: string,
): boolean {
  const hubNodeId = (node.data as { hubNodeId?: string }).hubNodeId;
  if (hubNodeId) return hubNodeId === scriptHubId;
  return true;
}

/** 三列媒体节点是否仍存在于画布且归属本大纲 */
export function workspaceMediaColumnsLive(
  nodes: CanvasFlowNode[],
  ws: StoryWorkspaceIds,
  scriptHubId: string,
): boolean {
  if (!ws.characterColumnId || !ws.frameColumnId || !ws.videoColumnId) {
    return false;
  }
  for (const colId of [
    ws.characterColumnId,
    ws.frameColumnId,
    ws.videoColumnId,
  ]) {
    const col = nodes.find((n) => n.id === colId);
    if (!col) return false;
    if (!workspaceNodeBelongsToHub(col, scriptHubId)) return false;
  }
  return true;
}

/** 清理 starter 上已删除节点的 stale workspaceIds，并重置误标 finalized */
export function reconcileStoryStarterWorkspaces(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "story-comic-starter") return n;
    const stored = (n.data as { workspaceIds?: StoryWorkspaceIds })
      .workspaceIds;
    if (!stored?.scriptHubId) return n;
    const ws = findStoryWorkspaceForStarter(
      nodes,
      edges,
      n.id,
      stored,
    );
    if (!ws) return n;
    const mediaLive = workspaceMediaColumnsLive(nodes, ws, ws.scriptHubId);
    const stage = (n.data as { pipelineStage?: string }).pipelineStage;
    const patch: Record<string, unknown> = {};
    const storedJson = JSON.stringify(stored);
    const wsJson = JSON.stringify(ws);
    if (storedJson !== wsJson) {
      patch.workspaceIds = ws;
    }
    if (!mediaLive && stage === "finalized") {
      patch.pipelineStage = "llm_done";
    }
    if (!Object.keys(patch).length) return n;
    return { ...n, data: { ...n.data, ...patch } };
  });
}

/** 用户删除本套媒体列后 · 解除故事大纲定稿锁定，允许重新编辑/定稿 */
export function reconcileStoryHubFinalized(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  return nodes.map((n) => {
    if (n.type !== "story-script-hub") return n;
    const d = n.data as { scriptFinalized?: boolean };
    if (!d.scriptFinalized) return n;
    if (scriptHubHasOutputWorkflow(nodes, edges, n.id)) return n;
    return {
      ...n,
      data: { ...n.data, scriptFinalized: false },
    };
  });
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
    for (const key of WORKSPACE_COLUMN_KEYS) {
      if (ids[key]) continue;
      const sid = stored[key];
      if (!sid) continue;
      const node = nodes.find((n) => n.id === sid);
      if (!node || node.type !== workspaceColumnType(key)) continue;
      if (!workspaceNodeBelongsToHub(node, hubLink.scriptHubId)) continue;
      ids[key] = sid;
    }
  }
  return ids;
}

/** 故事大纲节点 → 对应的漫剧启动节点（多工作流画布须按 hub 隔离） */
export function findStarterForScriptHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
): CanvasFlowNode | undefined {
  for (const n of nodes) {
    if (n.type !== "story-comic-starter") continue;
    const ws = (n.data as { workspaceIds?: StoryWorkspaceIds }).workspaceIds;
    if (ws?.scriptHubId === scriptHubId) return n;
  }
  for (const e of edges) {
    if (e.target !== scriptHubId) continue;
    const src = nodes.find((n) => n.id === e.source);
    if (src?.type === "story-comic-starter") return src;
  }
  return undefined;
}

/** 指定文案中枢的工作区 ID（不与其他 starter 混用） */
export function findWorkspaceForScriptHub(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
): StoryWorkspaceIds | null {
  const starter = findStarterForScriptHub(nodes, edges, scriptHubId);
  if (!starter) return null;
  const stored = (starter.data as { workspaceIds?: StoryWorkspaceIds })
    .workspaceIds;
  const ws = findStoryWorkspaceForStarter(
    nodes,
    edges,
    starter.id,
    stored?.scriptHubId === scriptHubId ? stored : { scriptHubId },
  );
  if (!ws || ws.scriptHubId !== scriptHubId) return null;
  return ws;
}

/** 本大纲是否已输出过媒体工作流（角色列 + 分镜列 + 视频列） */
export function scriptHubHasOutputWorkflow(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
): boolean {
  const ws = findWorkspaceForScriptHub(nodes, edges, scriptHubId);
  if (!ws) return false;
  return workspaceMediaColumnsLive(nodes, ws, scriptHubId);
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

const LLM_PARAMS = { ...STORY_OUTLINE_LLM_PARAMS };

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

type SpawnMediaAddNodeType =
  | "story-script-hub"
  | "story-character-column"
  | "story-frame-column"
  | "story-video-column"
  | "jianying-export";

function ensureJianyingExportLinked(args: {
  nodes: CanvasFlowNode[];
  videoColumnId: string;
  frameColumnId?: string;
  scriptHubId: string;
  /** 本套工作区已绑定的剪映节点；禁止复用画布上其它工作流的剪映 */
  jianyingExportId?: string;
  hubLeftX: number;
  originY: number;
  rowBottom: number;
  addNode: (
    type: SpawnMediaAddNodeType,
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: SpawnMediaArgs["setEdges"];
}): string {
  let exportId = args.jianyingExportId;
  if (exportId) {
    const existing = args.nodes.find(
      (n) => n.id === exportId && n.type === "jianying-export",
    );
    if (!existing) exportId = undefined;
  }

  const [, , , jianyingX] = storyMediaColumnXs(args.hubLeftX);
  const jianyingY = storyMediaColumnY(
    args.originY,
    args.rowBottom,
    "jianying-export",
  );

  if (!exportId) {
    exportId = args.addNode(
      "jianying-export",
      { x: jianyingX, y: jianyingY },
      { label: "剪映导出", hubNodeId: args.scriptHubId },
    );
  }

  if (
    !columnBelongsToHub(args.nodes, args.videoColumnId, args.scriptHubId) ||
    (args.frameColumnId &&
      !columnBelongsToHub(args.nodes, args.frameColumnId, args.scriptHubId))
  ) {
    return exportId;
  }

  args.setEdges((prev) =>
    prev.filter((e) => {
      const fromMedia =
        e.source === args.videoColumnId ||
        e.source === args.frameColumnId;
      if (!fromMedia) return true;
      const target = args.nodes.find((n) => n.id === e.target);
      if (target?.type !== "jianying-export") return true;
      return e.target === exportId;
    }),
  );

  connect(args.setEdges, args.videoColumnId, exportId, "text", "in_storyboard");
  if (args.frameColumnId) {
    connect(
      args.setEdges,
      args.frameColumnId,
      exportId,
      "text",
      "in_storyboard",
    );
  }

  return exportId;
}

/** 去掉跨工作流的「媒体列 → 剪映」连线 */
export function reconcileStoryWorkspaceEdges(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowEdge[] {
  return edges.filter((e) => {
    const target = nodes.find((n) => n.id === e.target);
    const source = nodes.find((n) => n.id === e.source);
    if (target?.type !== "jianying-export") return true;
    if (
      source?.type !== "story-frame-column" &&
      source?.type !== "story-video-column"
    ) {
      return true;
    }
    const srcHub = (source.data as { hubNodeId?: string }).hubNodeId;
    const jyHub = (target.data as { hubNodeId?: string }).hubNodeId;
    if (srcHub && jyHub && srcHub !== jyHub) return false;
    return true;
  });
}

/** 解析本套工作流绑定的剪映节点 */
export function resolveJianyingExportId(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  scriptHubId: string,
  ws?: StoryWorkspaceIds | null,
): string | undefined {
  if (ws?.jianyingExportId) {
    const hit = nodes.find(
      (n) =>
        n.id === ws.jianyingExportId &&
        n.type === "jianying-export" &&
        workspaceNodeBelongsToHub(n, scriptHubId),
    );
    if (hit) return hit.id;
  }
  const byHub = nodes.find(
    (n) =>
      n.type === "jianying-export" &&
      (n.data as { hubNodeId?: string }).hubNodeId === scriptHubId,
  );
  if (byHub) return byHub.id;
  if (ws?.videoColumnId) {
    for (const e of edges) {
      if (e.source !== ws.videoColumnId) continue;
      const t = nodes.find(
        (n) => n.id === e.target && n.type === "jianying-export",
      );
      if (t && workspaceNodeBelongsToHub(t, scriptHubId)) return t.id;
    }
  }
  return undefined;
}

function columnBelongsToHub(
  nodes: CanvasFlowNode[],
  columnId: string,
  scriptHubId: string,
): boolean {
  const col = nodes.find((n) => n.id === columnId);
  if (!col) return false;
  return workspaceNodeBelongsToHub(col, scriptHubId);
}

type SpawnMediaArgs = SpawnHubArgs & {
  scriptHubId: string;
  addNode: (
    type: SpawnMediaAddNodeType,
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
    existing &&
    workspaceMediaColumnsLive(args.nodes, existing, args.scriptHubId)
  ) {
    const hub = args.nodes.find((n) => n.id === args.scriptHubId);
    const starter = args.nodes.find((n) => n.id === args.starterNodeId);
    const originY = starter?.position.y ?? 120;
    const hubLeftX =
      hub?.position.x ??
      (starter?.position.x ?? 80) +
        STORY_CONTROL_NODE_WIDTH +
        STORY_WORKSPACE_COL_H_GAP;
    const rowBottom = storyControlRowBottom(originY);
    const jianyingExportId = ensureJianyingExportLinked({
      nodes: args.nodes,
      videoColumnId: existing.videoColumnId!,
      frameColumnId: existing.frameColumnId,
      scriptHubId: args.scriptHubId,
      jianyingExportId: existing.jianyingExportId,
      hubLeftX,
      originY,
      rowBottom,
      addNode: args.addNode,
      setEdges: args.setEdges,
    });
    args.updateNodeData(args.starterNodeId, {
      workspaceIds: {
        scriptHubId: args.scriptHubId,
        characterColumnId: existing.characterColumnId,
        frameColumnId: existing.frameColumnId,
        videoColumnId: existing.videoColumnId,
        jianyingExportId,
      },
    });
    return {
      scriptHubId: args.scriptHubId,
      characterColumnId: existing.characterColumnId,
      frameColumnId: existing.frameColumnId,
      videoColumnId: existing.videoColumnId,
      jianyingExportId,
    };
  }

  const hub = args.nodes.find((n) => n.id === args.scriptHubId);
  const starter = args.nodes.find((n) => n.id === args.starterNodeId);
  const originY = starter?.position.y ?? 120;
  const hubLeftX = hub?.position.x ?? (starter?.position.x ?? 80) + STORY_CONTROL_NODE_WIDTH + STORY_WORKSPACE_COL_H_GAP;
  const rowBottom = storyControlRowBottom(originY);
  const [charX, frameX, videoX] = storyMediaColumnXs(hubLeftX);
  const charY = storyMediaColumnY(originY, rowBottom, "story-character-column");
  const frameY = storyMediaColumnY(originY, rowBottom, "story-frame-column");
  const videoY = storyMediaColumnY(originY, rowBottom, "story-video-column");

  const characterColumnId =
    existing?.characterColumnId ??
    args.addNode(
      "story-character-column",
      { x: charX, y: charY },
      { rows: [], hubNodeId: args.scriptHubId },
    );

  const frameColumnId =
    existing?.frameColumnId ??
    args.addNode(
      "story-frame-column",
      { x: frameX, y: frameY },
      { rows: [], hubNodeId: args.scriptHubId },
    );

  const videoColumnId =
    existing?.videoColumnId ??
    args.addNode(
      "story-video-column",
      { x: videoX, y: videoY },
      { rows: [], hubNodeId: args.scriptHubId, frameColumnId },
    );

  connect(args.setEdges, args.scriptHubId, characterColumnId, "text", "in_text");
  connect(args.setEdges, characterColumnId, frameColumnId, "text", "in_text");
  connect(args.setEdges, frameColumnId, videoColumnId, "text", "in_text");

  const jianyingExportId = ensureJianyingExportLinked({
    nodes: args.nodes,
    videoColumnId,
    frameColumnId,
    scriptHubId: args.scriptHubId,
    hubLeftX,
    originY,
    rowBottom,
    addNode: args.addNode,
    setEdges: args.setEdges,
  });

  const ids: StoryWorkspaceIds = {
    scriptHubId: args.scriptHubId,
    characterColumnId,
    frameColumnId,
    videoColumnId,
    jianyingExportId,
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
