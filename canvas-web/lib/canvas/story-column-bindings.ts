"use client";

import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeRuntime } from "./types";
import { parseCharacterRows, parseStoryboardRows } from "./parse-md-tables";
import { STORY_GROUP_CHARACTERS, STORY_GROUP_FRAMES } from "./story-comic-groups";

export type StoryColumnRowStatus = "idle" | "running" | "done" | "error";

export type StoryCharacterColumnRow = {
  key: string;
  name: string;
  role: string;
  appearance: string;
  textNodeId?: string;
  threeViewNodeId?: string;
  imageUrl?: string;
  status: StoryColumnRowStatus;
  failMessage?: string;
};

export type StoryFrameColumnRow = {
  key: string;
  frameIndex: number;
  scene: string;
  description: string;
  dialogue: string;
  imageNodeId?: string;
  imageUrl?: string;
  status: StoryColumnRowStatus;
  failMessage?: string;
};

function runtimeStatus(
  rt?: CanvasNodeRuntime,
): StoryColumnRowStatus {
  const s = rt?.status ?? "idle";
  if (s === "running" || s === "pending") return "running";
  if (s === "done") return "done";
  if (s === "error") return "error";
  return "idle";
}

function imageUrlFromRuntime(rt?: CanvasNodeRuntime): string | undefined {
  return rt?.ossUrl || rt?.ephemeralUrl;
}

export function collectCharacterColumnRows(
  nodes: CanvasFlowNode[],
  characterMd: string,
): StoryCharacterColumnRow[] {
  const rows = parseCharacterRows(characterMd);
  const groupChildren = nodes.filter((n) => n.parentId === STORY_GROUP_CHARACTERS);

  return rows.map((c) => {
    const textNode = groupChildren.find((n) => {
      if (n.type !== "text") return false;
      const t = String((n.data as { text?: string }).text ?? "");
      return t.includes(`[${c.name}]`);
    });
    const tvNode = groupChildren.find((n) => {
      if (n.type !== "three-view-engine") return false;
      return (n.data as { characterName?: string }).characterName === c.name;
    });
    const rt = (tvNode?.data as { runtime?: CanvasNodeRuntime }).runtime;
    return {
      key: c.name,
      name: c.name,
      role: c.role,
      appearance: c.appearance,
      textNodeId: textNode?.id,
      threeViewNodeId: tvNode?.id,
      imageUrl: imageUrlFromRuntime(rt),
      status: tvNode ? runtimeStatus(rt) : "idle",
      failMessage: rt?.failMessage,
    };
  });
}

export function collectStoryboardColumnRows(
  nodes: CanvasFlowNode[],
  storyboardMd: string,
): StoryFrameColumnRow[] {
  const scriptRows = parseStoryboardRows(storyboardMd);
  const groupChildren = nodes.filter((n) => n.parentId === STORY_GROUP_FRAMES);
  const frameNodes = nodes.filter(
    (n) =>
      n.type === "image-engine" &&
      (n.data as { frameIndex?: number }).frameIndex != null,
  );
  const byIndex = new Map(
    [...groupChildren, ...frameNodes].map((n) => [
      (n.data as { frameIndex?: number }).frameIndex as number,
      n,
    ]),
  );

  return scriptRows.map((r) => {
    const img = byIndex.get(r.frameIndex);
    const rt = (img?.data as { runtime?: CanvasNodeRuntime }).runtime;
    return {
      key: String(r.frameIndex),
      frameIndex: r.frameIndex,
      scene: r.scene,
      description: r.description,
      dialogue: r.dialogue,
      imageNodeId: img?.id,
      imageUrl: imageUrlFromRuntime(rt),
      status: img ? runtimeStatus(rt) : "idle",
      failMessage: rt?.failMessage,
    };
  });
}

export function findCharacterThreeViewNodeId(
  nodes: CanvasFlowNode[],
  name: string,
): string | undefined {
  return nodes.find(
    (n) =>
      n.type === "three-view-engine" &&
      (n.data as { characterName?: string }).characterName === name,
  )?.id;
}

export function findFrameImageNodeId(
  nodes: CanvasFlowNode[],
  frameIndex: number,
): string | undefined {
  return nodes.find(
    (n) =>
      n.type === "image-engine" &&
      (n.data as { frameIndex?: number }).frameIndex === frameIndex,
  )?.id;
}
