"use client";

import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export const STORY_GROUP_CHARACTERS = "sc-group-characters";
export const STORY_GROUP_FRAMES = "sc-group-frames";
export const STORY_GROUP_VIDEOS = "sc-group-videos";

const GROUP_SPECS: Array<{
  id: string;
  label: string;
  color: string;
  relX: number;
}> = [
  {
    id: STORY_GROUP_CHARACTERS,
    label: "角色列 · 设定与三视图",
    color: "#22c55e",
    relX: 520,
  },
  {
    id: STORY_GROUP_FRAMES,
    label: "分镜列 · 脚本与分镜图",
    color: "#38bdf8",
    relX: 1120,
  },
  {
    id: STORY_GROUP_VIDEOS,
    label: "视频列 · 分镜视频与对白",
    color: "#a78bfa",
    relX: 1720,
  },
];

type SpawnGroupArgs = {
  starterNodeId: string;
  nodes: CanvasFlowNode[];
  addNode: (
    type: "group",
    position: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
};

/** 漫剧画布预置三列分组（角色 / 分镜图 / 视频）。已有则跳过。 */
export function spawnStoryComicColumnGroups(
  args: SpawnGroupArgs,
): Record<string, string> {
  const starter =
    args.nodes.find((n) => n.id === args.starterNodeId) ??
    args.nodes.find((n) => n.type === "story-comic-starter");
  const base = starter?.position ?? { x: 80, y: 200 };
  const out: Record<string, string> = {};

  for (const spec of GROUP_SPECS) {
    const existing = args.nodes.find((n) => n.id === spec.id);
    if (existing) {
      out[spec.id] = existing.id;
      continue;
    }
    const id = args.addNode(
      "group",
      { x: base.x + spec.relX, y: base.y },
      {
        label: spec.label,
        color: spec.color,
        style: { width: 720, height: 480 },
      },
    );
    out[spec.id] = id;
  }

  return out;
}

export function hasStoryComicColumnGroups(nodes: CanvasFlowNode[]): boolean {
  return nodes.some(
    (n) =>
      n.id === STORY_GROUP_CHARACTERS ||
      n.id === STORY_GROUP_FRAMES ||
      n.id === STORY_GROUP_VIDEOS,
  );
}
