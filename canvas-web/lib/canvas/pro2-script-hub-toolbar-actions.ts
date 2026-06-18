"use client";

import type { Pro2ThreeViewBatchImagePick } from "./pro2-three-view-batch-image";
import {
  enqueuePro2ScriptGeneration,
  kickoffPro2CharacterThreeViewFromHub,
  kickoffPro2FrameBoardFromHub,
  kickoffPro2SceneImageFromHub,
  pro2HubHasScriptTable,
  pro2HubIsLinkedOutline,
  type KickoffPro2FrameBoardOptions,
} from "./pro2-script-hub-helpers";
import type { Pro2SceneBatchImagePick } from "./pro2-scene-batch-image";
import { resolveHubStoryboardMd } from "./story-hub-runtime";
import type { StoryRefImage } from "./story-ref-image";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export function downloadPro2ScriptMarkdown(md: string, title: string): void {
  const safe = (title.trim() || "脚本").replace(/[/\\?%*:|"<>]/g, "_");
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 工具栏「重新生成」：重新生成完整脚本（大纲 + 角色 + 脚本表） */
export function regeneratePro2ScriptHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  dockInput: string,
  dockRefImages: StoryRefImage[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
): boolean {
  const hasInput =
    pro2HubIsLinkedOutline(nodes, edges, hubId, hubData) ||
    hubData.dockInput?.trim() ||
    dockInput.trim() ||
    hubData.outlineMd?.trim();
  if (!hasInput) return false;

  enqueuePro2ScriptGeneration(
    hubId,
    dockInput,
    dockRefImages,
    updateNodeData,
    { forceFresh: true, nodes, edges, hubData, regenerateAll: true },
  );
  return true;
}

export function generatePro2FrameBoardFromHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  dockInput: string,
  dockRefImages: StoryRefImage[],
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  getStore: () => {
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
  },
  selectedFrameIndices?: number[],
  batchImage?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  },
): boolean {
  if (!pro2HubHasScriptTable(hubData)) return false;
  const opts: KickoffPro2FrameBoardOptions = {};
  if (selectedFrameIndices?.length) {
    opts.selectedFrameIndices = selectedFrameIndices;
  }
  if (batchImage?.providerId?.trim() && batchImage.modelKey?.trim()) {
    opts.batchImage = batchImage;
  }
  kickoffPro2FrameBoardFromHub(
    getStore,
    hubId,
    hubData,
    dockInput,
    dockRefImages,
    providers,
    Object.keys(opts).length ? opts : undefined,
  );
  return true;
}

export function generatePro2CharacterThreeViewFromHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  getStore: () => {
    nodes: CanvasFlowNode[];
    edges: CanvasFlowEdge[];
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
  },
  selectedCharacterKeys?: string[],
  batchImage?: Pro2ThreeViewBatchImagePick,
): boolean {
  const opts: {
    characterKeys?: string[];
    batchImage?: Pro2ThreeViewBatchImagePick;
  } = {};
  if (selectedCharacterKeys?.length) {
    opts.characterKeys = selectedCharacterKeys;
  }
  if (batchImage?.providerId?.trim() && batchImage.modelKey?.trim()) {
    opts.batchImage = batchImage;
  }
  return (
    kickoffPro2CharacterThreeViewFromHub(
      getStore,
      hubId,
      hubData,
      providers,
      Object.keys(opts).length ? opts : undefined,
    ) != null
  );
}

export function generatePro2SceneImageFromHub(
  hubId: string,
  hubData: StoryProScriptHubNodeData,
  providers: import("@/lib/canvas-providers-api").CanvasProviderDto[],
  getStore: () => {
    nodes: CanvasFlowNode[];
    edges: CanvasFlowEdge[];
    addNode: (
      type:
        | "story-pro2-character"
        | "story-pro2-scene"
        | "story-pro2-frame"
        | "story-pro2-image"
        | "story-pro2-three-view"
        | "group",
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
  },
  selectedSceneKeys?: string[],
  batchImage?: Pro2SceneBatchImagePick,
): boolean {
  const opts: {
    sceneKeys?: string[];
    batchImage?: Pro2SceneBatchImagePick;
  } = {};
  if (selectedSceneKeys?.length) {
    opts.sceneKeys = selectedSceneKeys;
  }
  if (batchImage?.providerId?.trim() && batchImage.modelKey?.trim()) {
    opts.batchImage = batchImage;
  }
  return (
    kickoffPro2SceneImageFromHub(
      getStore,
      hubId,
      hubData,
      providers,
      Object.keys(opts).length ? opts : undefined,
    ) != null
  );
}

export function pro2ScriptHubExportMarkdown(
  hubData: StoryProScriptHubNodeData,
): string {
  const storyboard = resolveHubStoryboardMd(hubData).trim();
  const character = hubData.characterMd?.trim() ?? "";
  const parts: string[] = [];
  if (character) parts.push(character);
  if (storyboard) parts.push(storyboard);
  return parts.join("\n\n---\n\n");
}
