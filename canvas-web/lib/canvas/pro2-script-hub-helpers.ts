"use client";

import {
  STORY_PRO2_CHARACTER_PROMPT,
  STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
  STORY_PRO2_SCENE_PROMPT,
  STORY_PRO2_STORYBOARD_PROMPT,
} from "./story-pro2-theme-outline-prompt";
import { parseCharacterRows, parseSceneVisualDictionaryRows, parseStoryboardRows } from "./parse-md-tables";
import {
  hubAggregateStatus,
  hubDataForColumnSync,
  hubSectionIsRunning,
  resolveHubStoryboardMd,
} from "./story-hub-runtime";
import { syncStoryProColumnRows } from "./story-pro-column-sync";
import {
  batchRunStoryRowsSequential,
  runStoryHubSectionsSequential,
} from "./batch-run-nodes";
import { pickDefaultStoryImageEngine } from "./system-providers";
import type { StoryRefImage } from "./story-ref-image";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";
import type { StoryLlmSection } from "./story-workspace-types";
import type { StoryPro2WorkspaceIds } from "./story-pro2-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { resolveStarterForHub } from "./story-workspace-resolver";
import {
  findStoryPro2WorkspaceForStarter,
  spawnStoryPro2CharacterColumnFromHub,
  spawnStoryPro2FrameColumnFromHub,
} from "./spawn-story-pro2-workspace";
import {
  pickDefaultPro2ThreeViewImageEngine,
  type Pro2ThreeViewBatchImagePick,
} from "./pro2-three-view-batch-image";
import { reflowStoryPro2Workspace } from "./story-pro2-workspace-layout";
import { pro2ThinNodeIsLinked } from "./pro2-thin-node-display-state";
import { extractSceneSectionMd } from "./parse-md-tables";
import { ensurePro2FrameImageGroup } from "./pro2-spawn-frame-image-group";
import { ensurePro2CharacterImageGroup } from "./pro2-spawn-character-image-group";
import { formatCharacterRowThreeViewPrompt } from "./three-view-prompt-rules";
export function pro2HubHasScriptTable(d: StoryProScriptHubNodeData): boolean {
  const md = resolveHubStoryboardMd(d);
  return parseStoryboardRows(md).length > 0;
}

/** 角色表 Markdown（含从大纲拆出的角色段） */
export function resolvePro2HubCharacterMd(
  d: StoryProScriptHubNodeData,
): string {
  const synced = hubDataForColumnSync(
    d as Parameters<typeof hubDataForColumnSync>[0],
  );
  return (synced.characterMd ?? "").trim();
}

export function pro2HubHasCharacterTable(d: StoryProScriptHubNodeData): boolean {
  return parseCharacterRows(resolvePro2HubCharacterMd(d)).length > 0;
}

export function pro2HubHasOutlineContent(d: StoryProScriptHubNodeData): boolean {
  return Boolean(d.outlineMd?.trim());
}

export function resolvePro2HubSceneMd(d: StoryProScriptHubNodeData): string {
  if (d.sceneMd?.trim()) return d.sceneMd.trim();
  return extractSceneSectionMd(d.outlineMd ?? "");
}

export function pro2HubHasSceneTable(d: StoryProScriptHubNodeData): boolean {
  return parseSceneVisualDictionaryRows(resolvePro2HubSceneMd(d)).length > 0;
}

/** 2.0 脚本 hub LLM 顺序：大纲 → 角色 → 场景 → 分镜 */
export const PRO2_HUB_SECTION_ORDER: StoryLlmSection[] = [
  "outline",
  "character",
  "scene",
  "storyboard",
];

export function resolvePro2HubLinkedStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
): { starterId: string; starter: CanvasFlowNode } | null {
  const starter = resolveStarterForHub(nodes, edges, hubId);
  if (!starter) return null;
  return { starterId: starter.id, starter };
}

/** 大纲真源：hub 字段 → 上游文本节点 generated / uploaded */
export function resolvePro2HubEffectiveOutline(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): string {
  const onHub = d.outlineMd?.trim();
  if (onHub) return onHub;
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return "";
  const sd = linked.starter.data as unknown as StoryProStarterNodeData;
  return (
    sd.generatedOutlineMd?.trim() ||
    sd.uploadedScriptMd?.trim() ||
    ""
  );
}

export function resolvePro2HubThemeInput(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): string {
  const dock = d.dockInput?.trim();
  if (dock) return dock;
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return "";
  const sd = linked.starter.data as unknown as StoryProStarterNodeData;
  return sd.themeInput?.trim() || "";
}

export function pro2HubIsLinkedOutline(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  hubId: string,
  d: StoryProScriptHubNodeData,
): { starterId: string; outlineMd: string } | null {
  const linked = resolvePro2HubLinkedStarter(nodes, edges, hubId);
  if (!linked) return null;
  const outline = resolvePro2HubEffectiveOutline(nodes, edges, hubId, d);
  return { starterId: linked.starterId, outlineMd: outline };
}

export function pro2HubIsGenerating(node: CanvasFlowNode): boolean {
  return hubAggregateStatus(node) === "running";
}

export function mergePro2DockIntoPrompt(
  base: string,
  dockInput: string,
  refs: StoryRefImage[],
): string {
  const parts = [base.trim()];
  const extra = dockInput.trim();
  if (extra) parts.push(`## 用户补充\n${extra}`);
  const refLines = refs
    .filter((r) => r.url && /^https?:\/\//.test(r.url))
    .map((r) => `- ${r.label}: ${r.url}`);
  if (refLines.length) {
    parts.push(`## 参考图\n${refLines.join("\n")}`);
  }
  return parts.join("\n\n");
}

/** 阶段 A：生成专业版脚本（大纲 → 角色 → 分镜脚本表） */
export function enqueuePro2ScriptGeneration(
  hubId: string,
  dockInput: string,
  dockRefImages: StoryRefImage[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  options?: {
    forceFresh?: boolean;
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
    hubData?: StoryProScriptHubNodeData;
    /** Dock 发送时始终生成全部三段（大纲 + 角色 + 脚本） */
    regenerateAll?: boolean;
  },
): void {
  const nodes = options?.nodes ?? [];
  const edges = options?.edges ?? [];
  const hubData = options?.hubData;
  const effectiveOutline =
    hubData && nodes.length
      ? resolvePro2HubEffectiveOutline(nodes, edges, hubId, hubData)
      : hubData?.outlineMd?.trim() ?? "";

  const dockMergedOutline = mergePro2DockIntoPrompt(
    STORY_PRO2_HUB_OUTLINE_FROM_THEME_PROMPT,
    dockInput,
    dockRefImages,
  );
  const dockMergedCharacter = mergePro2DockIntoPrompt(
    STORY_PRO2_CHARACTER_PROMPT,
    dockInput,
    dockRefImages,
  );
  const dockMergedScene = mergePro2DockIntoPrompt(
    STORY_PRO2_SCENE_PROMPT,
    dockInput,
    dockRefImages,
  );
  const dockMergedStoryboard = mergePro2DockIntoPrompt(
    STORY_PRO2_STORYBOARD_PROMPT,
    dockInput,
    dockRefImages,
  );

  const sections: StoryLlmSection[] =
    options?.regenerateAll || !effectiveOutline
      ? [...PRO2_HUB_SECTION_ORDER]
      : ["character", "scene", "storyboard"];

  const patch: Record<string, unknown> = {
    dockInput,
    dockRefImages,
    promptOutline: dockMergedOutline,
    promptCharacter: dockMergedCharacter,
    promptScene: dockMergedScene,
    promptStoryboard: dockMergedStoryboard,
  };
  if (effectiveOutline && !hubData?.outlineMd?.trim()) {
    patch.outlineMd = effectiveOutline;
  }
  const pendingRuntime = { status: "pending" as const };
  if (sections.includes("outline")) {
    patch.outlineRuntime = pendingRuntime;
  }
  if (sections.includes("character")) {
    patch.characterRuntime = pendingRuntime;
  }
  if (sections.includes("scene")) {
    patch.sceneRuntime = pendingRuntime;
  }
  if (sections.includes("storyboard")) {
    patch.storyboardRuntime = pendingRuntime;
  }

  updateNodeData(hubId, patch);

  runStoryHubSectionsSequential(hubId, sections, options);
}

type FrameKickoffStore = {
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: (
    type: "story-pro2-frame" | "story-pro2-image" | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  addNodeInGroup: (
    type: "story-pro2-image" | "story-pro2-three-view",
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  createGroupContaining: (
    childIds: string[],
    opts: { label: string; color: string },
  ) => string | null;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  updateNodeData: (id: string, patch: Record<string, unknown>) => void;
  setNodes: (fn: (n: CanvasFlowNode[]) => CanvasFlowNode[]) => void;
};

export type KickoffPro2FrameBoardOptions = {
  /** 仅生成这些镜号；缺省为全部镜 */
  selectedFrameIndices?: number[];
  /** 分镜图 IMAGE 模型（弹层选择后写入分镜列） */
  batchImage?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
};

/** 阶段 B：spawn 分镜列、同步脚本行、批量生成分镜图 */
export function kickoffPro2FrameBoardFromHub(
  getStore: () => FrameKickoffStore,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  dockInput: string,
  dockRefImages: StoryRefImage[],
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  options?: KickoffPro2FrameBoardOptions,
): { frameColumnId: string } | null {
  let store = getStore();
  const starter = resolveStarterForHub(store.nodes, store.edges, hubId);
  if (!starter) return null;

  const storyboardMd = resolveHubStoryboardMd(hubData);
  if (!parseStoryboardRows(storyboardMd).length) return null;

  store.updateNodeData(hubId, { dockInput, dockRefImages });
  store = getStore();

  const ws =
    findStoryPro2WorkspaceForStarter(
      store.nodes,
      store.edges,
      starter.id,
      (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
    ) ?? ({ scriptHubId: hubId } as StoryPro2WorkspaceIds);

  let frameColumnId = ws.frameColumnId;
  if (!frameColumnId || !store.nodes.some((n) => n.id === frameColumnId)) {
    frameColumnId = spawnStoryPro2FrameColumnFromHub({
      scriptHubId: hubId,
      starterNodeId: starter.id,
      nodes: store.nodes,
      edges: store.edges,
      addNode: store.addNode,
      setEdges: store.setEdges,
      updateNodeData: store.updateNodeData,
    });
    store = getStore();
  }

  const frameNode = store.nodes.find((n) => n.id === frameColumnId);
  const existing = frameNode?.data as { rows?: unknown[] } | undefined;

  const synced = syncStoryProColumnRows(
    hubData,
    { frameRows: (existing?.rows ?? []) as never },
    hubId,
  );

  const dockNote = dockInput.trim();
  const refUrls = dockRefImages
    .filter((r) => r.url && /^https?:\/\//.test(r.url))
    .map((r) => ({ ...r }));

  const frameRows = synced.frameRows.map((row) => {
    const promptBase = row.prompt?.trim() || "";
    const withDock = dockNote
      ? `${promptBase}\n\n用户补充：${dockNote}`.trim()
      : promptBase;
    return {
      ...row,
      prompt: withDock,
      refImages: refUrls.length
        ? [...(row.refImages ?? []), ...refUrls]
        : row.refImages,
    };
  });

  store.updateNodeData(frameColumnId, { rows: frameRows, hubNodeId: hubId });
  store = getStore();

  const batchFromPicker = options?.batchImage;
  if (batchFromPicker?.providerId?.trim() && batchFromPicker.modelKey?.trim()) {
    store.updateNodeData(frameColumnId, {
      batchImage: {
        providerId: batchFromPicker.providerId,
        modelKey: batchFromPicker.modelKey,
        params: batchFromPicker.params ?? {
          aspect_ratio: "16:9",
          resolution: "2K",
          output_format: "png",
        },
      },
    });
  } else {
    const imagePick = pickDefaultStoryImageEngine(providers);
    if (imagePick) {
      const frameNow = store.nodes.find((n) => n.id === frameColumnId);
      const batch = (frameNow?.data as { batchImage?: unknown })?.batchImage as
        | { providerId?: string }
        | undefined;
      if (!batch?.providerId?.trim()) {
        store.updateNodeData(frameColumnId, {
          batchImage: {
            providerId: imagePick.providerId,
            modelKey: imagePick.modelKey,
            params: {
              aspect_ratio: "16:9",
              resolution: "2K",
              output_format: "png",
            },
          },
        });
      }
    }
  }

  let keys = frameRows.map((r) => r.key);
  const picked = options?.selectedFrameIndices?.filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  if (picked?.length) {
    const allowed = new Set(picked);
    keys = frameRows
      .filter((r) => allowed.has(r.frameIndex))
      .map((r) => r.key);
  }
  const edges = store.edges;
  store.setNodes((prev) => reflowStoryPro2Workspace(prev, edges));

  store = getStore();
  ensurePro2FrameImageGroup({
    frameColumnId: frameColumnId!,
    hubNodeId: hubId,
    rows: frameRows,
    nodes: store.nodes,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
  });

  if (keys.length) {
    window.setTimeout(() => {
      batchRunStoryRowsSequential(frameColumnId!, keys, "frameImage", {
        forceFresh: false,
      });
    }, 0);
  }

  return { frameColumnId };
}

type CharacterThreeViewKickoffStore = FrameKickoffStore & {
  addNode: (
    type:
      | "story-pro2-character"
      | "story-pro2-frame"
      | "story-pro2-image"
      | "story-pro2-three-view"
      | "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
};

export type KickoffPro2CharacterThreeViewOptions = {
  characterKeys?: string[];
  batchImage?: Pro2ThreeViewBatchImagePick;
};

/** 阶段 B′：spawn 人物设计列、同步角色行、批量生成三视图 */
export function kickoffPro2CharacterThreeViewFromHub(
  getStore: () => CharacterThreeViewKickoffStore,
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  options?: KickoffPro2CharacterThreeViewOptions,
): { characterColumnId: string } | null {
  if (!pro2HubHasCharacterTable(hubData)) return null;

  let store = getStore();
  const starter = resolveStarterForHub(store.nodes, store.edges, hubId);
  if (!starter) return null;

  const ws =
    findStoryPro2WorkspaceForStarter(
      store.nodes,
      store.edges,
      starter.id,
      (starter.data as { workspaceIds?: StoryPro2WorkspaceIds }).workspaceIds,
    ) ?? ({ scriptHubId: hubId } as StoryPro2WorkspaceIds);

  let characterColumnId = ws.characterColumnId;
  if (
    !characterColumnId ||
    !store.nodes.some((n) => n.id === characterColumnId)
  ) {
    characterColumnId = spawnStoryPro2CharacterColumnFromHub({
      scriptHubId: hubId,
      starterNodeId: starter.id,
      nodes: store.nodes,
      edges: store.edges,
      addNode: store.addNode,
      setEdges: store.setEdges,
      updateNodeData: store.updateNodeData,
    });
    store = getStore();
  }

  const charNode = store.nodes.find((n) => n.id === characterColumnId);
  const existing = charNode?.data as { rows?: unknown[] } | undefined;
  const synced = syncStoryProColumnRows(
    hubData,
    { characterRows: (existing?.rows ?? []) as never },
    hubId,
  );

  const refreshedCharacterRows = synced.characterRows.map((row) => ({
    ...row,
    prompt: formatCharacterRowThreeViewPrompt({
      name: row.name,
      role: row.role,
      appearance: row.appearance,
    }),
  }));

  store.updateNodeData(characterColumnId, {
    rows: refreshedCharacterRows,
    hubNodeId: hubId,
  });
  store = getStore();

  const batchFromPicker = options?.batchImage;
  if (batchFromPicker?.providerId?.trim() && batchFromPicker.modelKey?.trim()) {
    store.updateNodeData(characterColumnId, {
      batchImage: {
        providerId: batchFromPicker.providerId,
        modelKey: batchFromPicker.modelKey,
        params: batchFromPicker.params ?? {
          aspect_ratio: "16:9",
          resolution: "2K",
          output_format: "png",
        },
      },
    });
  } else {
    const imagePick = pickDefaultPro2ThreeViewImageEngine(providers);
    if (imagePick) {
      const colNow = store.nodes.find((n) => n.id === characterColumnId);
      const batch = (colNow?.data as { batchImage?: unknown })?.batchImage as
        | { providerId?: string }
        | undefined;
      if (!batch?.providerId?.trim()) {
        store.updateNodeData(characterColumnId, {
          batchImage: {
            providerId: imagePick.providerId,
            modelKey: imagePick.modelKey,
            params: {
              aspect_ratio: "16:9",
              resolution: "2K",
              output_format: "png",
            },
          },
        });
      }
    }
  }

  let keys = refreshedCharacterRows.map((r) => r.key);
  const picked = options?.characterKeys?.filter((k) => k.trim());
  if (picked?.length) {
    const allowed = new Set(picked);
    keys = refreshedCharacterRows
      .filter((r) => allowed.has(r.key) || allowed.has(r.name))
      .map((r) => r.key);
  }
  const edges = store.edges;
  store.setNodes((prev) => reflowStoryPro2Workspace(prev, edges));

  store = getStore();
  ensurePro2CharacterImageGroup({
    characterColumnId: characterColumnId!,
    hubNodeId: hubId,
    rows: refreshedCharacterRows,
    nodes: store.nodes,
    addNode: store.addNode,
    addNodeInGroup: store.addNodeInGroup,
    createGroupContaining: store.createGroupContaining,
    updateNodeData: store.updateNodeData,
    setNodes: store.setNodes,
    setEdges: store.setEdges,
  });

  if (keys.length) {
    window.setTimeout(() => {
      batchRunStoryRowsSequential(characterColumnId!, keys, "threeView", {
        forceFresh: true,
      });
    }, 0);
  }

  return { characterColumnId };
}

export function pro2HubCanSendScriptPhase(
  node: CanvasFlowNode,
  d: StoryProScriptHubNodeData,
  ctx?: {
    nodes?: CanvasFlowNode[];
    edges?: CanvasFlowEdge[];
  },
): boolean {
  if (pro2HubIsGenerating(node)) return false;
  if (pro2HubHasScriptTable(d)) return false;
  if (!d.providerId?.trim() || !d.modelKey?.trim()) return false;
  if (d.dockInput?.trim()) return true;
  if (d.outlineMd?.trim()) return true;
  if (ctx?.nodes && ctx?.edges) {
    if (resolvePro2HubEffectiveOutline(ctx.nodes, ctx.edges, node.id, d)) {
      return true;
    }
    if (resolvePro2HubThemeInput(ctx.nodes, ctx.edges, node.id, d)) return true;
    if (pro2ThinNodeIsLinked(node.id, ctx.edges)) return true;
  }
  return false;
}

export function pro2HubCanSendFramePhase(
  node: CanvasFlowNode,
  d: StoryProScriptHubNodeData,
): boolean {
  if (pro2HubIsGenerating(node)) return false;
  if (!pro2HubHasScriptTable(d)) return false;
  const frameRunning =
    hubSectionIsRunning(node, "character") ||
    hubSectionIsRunning(node, "storyboard");
  if (frameRunning) return false;
  return Boolean(d.providerId?.trim() && d.modelKey?.trim());
}

export function pro2HubScriptPhaseLabel(
  d: StoryProScriptHubNodeData,
  ctx?: { nodeId?: string; nodes?: CanvasFlowNode[]; edges?: CanvasFlowEdge[] },
): string {
  if (pro2HubHasScriptTable(d)) return "frame";
  if (d.outlineMd?.trim()) return "script";
  if (d.dockInput?.trim()) return "script";
  if (ctx?.nodeId && ctx.nodes && ctx.edges) {
    if (resolvePro2HubEffectiveOutline(ctx.nodes, ctx.edges, ctx.nodeId, d)) {
      return "script";
    }
    if (resolvePro2HubThemeInput(ctx.nodes, ctx.edges, ctx.nodeId, d)) {
      return "script";
    }
    if (pro2ThinNodeIsLinked(ctx.nodeId, ctx.edges)) return "script";
  }
  return "empty";
}
