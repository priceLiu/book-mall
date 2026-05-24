"use client";

import { nanoid } from "nanoid";
import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType, ImageEngineNodeData } from "./types";
import {
  STORY_FRAME_IMAGE_PROMPT_DEFAULT,
  STORY_VIDEO_ENGINE_PROMPT_DEFAULT,
} from "./story-prompts";
import { THREE_VIEW_ENGINE_PROMPT_DEFAULT } from "./builtin-prompt-templates";
import { parseCharacterRows, parseStoryboardRows } from "./parse-md-tables";
import { directPredecessors } from "./topo";

type StoreAddNode = (
  type: CanvasNodeType,
  position: { x: number; y: number },
  data?: Record<string, unknown>,
) => string;

type BatchArgs = {
  sourceNodeId: string;
  markdown: string;
  /** 批量开始时的节点快照（兼容）；实时读 store 请用 getNodes */
  nodes: CanvasFlowNode[];
  getNodes?: () => CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: StoreAddNode;
  addNodeInGroup?: (
    type: CanvasNodeType,
    groupId: string,
    relativePosition: { x: number; y: number },
    data: Record<string, unknown>,
  ) => string;
  setEdges: (fn: (e: CanvasFlowEdge[]) => CanvasFlowEdge[]) => void;
  /** 批量节点落入「分镜媒体」分组 */
  reparentNode?: (nodeId: string, groupId: string) => void;
  /** Tab 内选定的 IMAGE 模型（不再从画布继承） */
  imageDefaults?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
  /** Tab 内选定的 VIDEO 模型（分镜视频批量） */
  videoDefaults?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
  /** 仅创建/处理这些角色名（三视图批量） */
  onlyCharacterNames?: string[];
  /** 仅创建/处理这些镜号（分镜图批量） */
  onlyFrameIndices?: number[];
};

function liveNodes(args: BatchArgs): CanvasFlowNode[] {
  return args.getNodes?.() ?? args.nodes;
}

function sourcePosition(nodes: CanvasFlowNode[], id: string) {
  const n = nodes.find((x) => x.id === id);
  return n?.position ?? { x: 400, y: 200 };
}

/** 模板内「分镜媒体」分组，或 label 含分镜媒体的 group */
export function findMediaGroupId(nodes: CanvasFlowNode[]): string | null {
  const byId = nodes.find((n) => n.id === "sc-group-media");
  if (byId) return byId.id;
  const byLabel = nodes.find(
    (n) =>
      n.type === "group" &&
      String((n.data as { label?: string }).label ?? "").includes("分镜媒体"),
  );
  return byLabel?.id ?? null;
}

export function findExportNodeId(nodes: CanvasFlowNode[]): string | null {
  return nodes.find((n) => n.type === "jianying-export")?.id ?? null;
}

function hasFrameNode(
  nodes: CanvasFlowNode[],
  type: CanvasNodeType,
  frameIndex: number,
): boolean {
  return nodes.some(
    (n) =>
      n.type === type &&
      (n.data as { frameIndex?: number }).frameIndex === frameIndex,
  );
}

function connectEdge(
  setEdges: BatchArgs["setEdges"],
  source: string,
  target: string,
  sourceHandle: string,
  targetHandle: string,
) {
  setEdges((prev) => {
    const exists = prev.some(
      (e) =>
        e.source === source &&
        e.target === target &&
        e.sourceHandle === sourceHandle,
    );
    if (exists) return prev;
    return [
      ...prev,
      { id: `e-${nanoid(6)}`, source, target, sourceHandle, targetHandle },
    ];
  });
}

function placeInGroup(
  args: BatchArgs,
  groupId: string,
  relX: number,
  relY: number,
  type: CanvasNodeType,
  data: Record<string, unknown>,
): string {
  if (args.addNodeInGroup) {
    return args.addNodeInGroup(type, groupId, { x: relX, y: relY }, data);
  }
  const group = liveNodes(args).find((n) => n.id === groupId);
  if (!group) {
    const base = sourcePosition(liveNodes(args), args.sourceNodeId);
    return args.addNode(type, { x: base.x + relX, y: base.y + relY }, data);
  }
  const abs = {
    x: group.position.x + relX,
    y: group.position.y + relY,
  };
  const id = args.addNode(type, abs, data);
  args.reparentNode?.(id, groupId);
  return id;
}

function nextFrameRowY(nodes: CanvasFlowNode[], groupId: string): number {
  const children = nodes.filter((n) => n.parentId === groupId);
  if (children.length === 0) return 56;
  const maxY = Math.max(...children.map((c) => c.position.y));
  return maxY + 280;
}

/** 模板内「角色三视图」分组 */
export function findCharacterGroupId(nodes: CanvasFlowNode[]): string | null {
  const byId = nodes.find((n) => n.id === "sc-group-characters");
  if (byId) return byId.id;
  const byLabel = nodes.find(
    (n) =>
      n.type === "group" &&
      String((n.data as { label?: string }).label ?? "").includes("角色三视图"),
  );
  return byLabel?.id ?? null;
}

function hasCharacterThreeView(nodes: CanvasFlowNode[], name: string): boolean {
  return nodes.some((n) => {
    if (n.type !== "three-view-engine") return false;
    const d = n.data as { characterName?: string; prompt?: string };
    if (d.characterName === name) return true;
    return (d.prompt ?? "").includes(`角色：${name}`) || (d.prompt ?? "").includes(`[${name}]`);
  });
}

export function collectThreeViewEngineIds(
  nodes: CanvasFlowNode[],
): string[] {
  return nodes.filter((n) => n.type === "three-view-engine").map((n) => n.id);
}

/** 从已配置的三视图 / 分镜图节点复制 Provider（批量创建时继承） */
export function resolveStoryImageEngineDefaults(
  nodes: CanvasFlowNode[],
): {
  providerId: string;
  modelKey: string;
  params: Record<string, unknown>;
} | null {
  for (const type of ["three-view-engine", "image-engine"] as const) {
    for (const n of nodes.filter((x) => x.type === type)) {
      const d = n.data as {
        providerId?: string;
        modelKey?: string;
        params?: Record<string, unknown>;
      };
      if (d.providerId?.trim() && d.modelKey?.trim()) {
        return {
          providerId: d.providerId,
          modelKey: d.modelKey,
          params: d.params ?? {},
        };
      }
    }
  }
  return null;
}

export function applyImageDefaultsToNodes(
  nodeIds: string[],
  defaults: { providerId: string; modelKey: string; params: Record<string, unknown> },
  getNodes: () => CanvasFlowNode[],
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
  force = false,
) {
  for (const id of nodeIds) {
    const n = getNodes().find((x) => x.id === id);
    if (!n) continue;
    const d = n.data as { providerId?: string; modelKey?: string };
    if (force || !d.providerId?.trim() || !d.modelKey?.trim()) {
      updateNodeData(id, defaults);
    }
  }
}

/** 将 Tab 内选定的模型写入批量创建的节点 */
export function applyEnginePickToNodes(
  nodeIds: string[],
  pick: { providerId: string; modelKey: string; params?: Record<string, unknown> },
  updateNodeData: (id: string, patch: Record<string, unknown>) => void,
) {
  for (const id of nodeIds) {
    updateNodeData(id, {
      providerId: pick.providerId,
      modelKey: pick.modelKey,
      params: pick.params ?? {},
    });
  }
}

export function collectFrameEngineIds(
  nodes: CanvasFlowNode[],
  type: "image-engine" | "video-engine" | "tts-engine",
  onlyFrameIndices?: number[],
): string[] {
  const allow =
    onlyFrameIndices?.length ? new Set(onlyFrameIndices) : null;
  return nodes
    .filter((n) => {
      if (n.type !== type) return false;
      const fi = (n.data as { frameIndex?: number }).frameIndex;
      if (fi == null) return false;
      return !allow || allow.has(fi);
    })
    .sort(
      (a, b) =>
        ((a.data as { frameIndex?: number }).frameIndex ?? 0) -
        ((b.data as { frameIndex?: number }).frameIndex ?? 0),
    )
    .map((n) => n.id);
}

export function collectThreeViewEngineIdsForCharacters(
  nodes: CanvasFlowNode[],
  characterNames?: string[],
): string[] {
  const allow = characterNames?.length ? new Set(characterNames) : null;
  return nodes
    .filter((n) => {
      if (n.type !== "three-view-engine") return false;
      const name = (n.data as { characterName?: string }).characterName;
      if (!name) return !allow;
      return !allow || allow.has(name);
    })
    .map((n) => n.id);
}

function findCharacterMarkdown(nodes: CanvasFlowNode[]): string {
  const n = nodes.find((x) => x.type === "character-engine");
  return (
    (n?.data as { runtime?: { textOutput?: string } })?.runtime?.textOutput ??
    ""
  );
}

function matchCharactersInText(
  text: string,
  chars: Array<{ name: string; appearance: string; role: string }>,
): Array<{ name: string; appearance: string; role: string }> {
  if (!text.trim()) return [];
  return chars.filter((c) => c.name && text.includes(c.name));
}

function mentionToken(nodeId: string): string {
  return `@<${nodeId}>`;
}

/** 分镜镜号 → 出镜角色 + 三视图 @ 引用 + prompt / referencedNodeIds */
function buildFrameImagePromptBundle(args: {
  frame: {
    scene: string;
    description: string;
    dialogue: string;
  };
  charRows: Array<{ name: string; appearance: string; role: string }>;
  nodes: CanvasFlowNode[];
  storyboardNodeId: string;
}): {
  prompt: string;
  referencedNodeIds: string[];
  tvIds: string[];
} {
  const sceneText = `${args.frame.scene} ${args.frame.description} ${args.frame.dialogue}`;
  const matched = matchCharactersInText(sceneText, args.charRows);
  const tvIds: string[] = [];
  const refIds = new Set<string>([args.storyboardNodeId]);

  const charLines = matched.map((c) => {
    const tvId = findThreeViewEngineId(args.nodes, c.name);
    if (tvId) {
      tvIds.push(tvId);
      refIds.add(tvId);
      return `- ${mentionToken(tvId)} [${c.name}] ${c.appearance}（必须与上游三视图参考图一致）`;
    }
    return `- [${c.name}] ${c.appearance}（必须与上游三视图参考图一致）`;
  });

  const prompt = [
    mentionToken(args.storyboardNodeId),
    STORY_FRAME_IMAGE_PROMPT_DEFAULT,
    charLines.length ? `\n出镜角色：\n${charLines.join("\n")}` : "",
    `\n场景：${args.frame.scene}`,
    `画面：${args.frame.description}`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    prompt,
    referencedNodeIds: Array.from(refIds),
    tvIds,
  };
}

function findThreeViewEngineId(
  nodes: CanvasFlowNode[],
  characterName: string,
): string | undefined {
  return nodes.find(
    (n) =>
      n.type === "three-view-engine" &&
      (n.data as { characterName?: string }).characterName === characterName,
  )?.id;
}

type ThreeViewReadiness = "ready" | "no_node" | "not_generated";

function getThreeViewReadiness(
  nodes: CanvasFlowNode[],
  characterName: string,
): ThreeViewReadiness {
  const node = nodes.find(
    (n) =>
      n.type === "three-view-engine" &&
      (n.data as { characterName?: string }).characterName === characterName,
  );
  if (!node) return "no_node";
  const rt = (
    node.data as {
      runtime?: { status?: string; ossUrl?: string; ephemeralUrl?: string };
    }
  ).runtime;
  const url = rt?.ossUrl || rt?.ephemeralUrl;
  if (rt?.status === "done" && url) return "ready";
  return "not_generated";
}

export type StoryboardFrameThreeViewGap = {
  frameIndex: number;
  characters: Array<{ name: string; reason: "no_node" | "not_generated" }>;
};

/** 按镜号检查：该镜出镜角色的三视图是否已创建且已生成 */
export function findStoryboardFramesMissingThreeView(args: {
  markdown: string;
  nodes: CanvasFlowNode[];
  onlyFrameIndices?: number[];
}): StoryboardFrameThreeViewGap[] {
  const frames = parseStoryboardRows(args.markdown).filter(
    (f) =>
      !args.onlyFrameIndices?.length ||
      args.onlyFrameIndices.includes(f.frameIndex),
  );
  if (!frames.length) return [];

  const charRows = parseCharacterRows(findCharacterMarkdown(args.nodes));
  const gaps: StoryboardFrameThreeViewGap[] = [];

  for (const f of frames) {
    const sceneText = `${f.scene} ${f.description} ${f.dialogue}`;
    const characters: StoryboardFrameThreeViewGap["characters"] = [];
    for (const c of matchCharactersInText(sceneText, charRows)) {
      const readiness = getThreeViewReadiness(args.nodes, c.name);
      if (readiness === "ready") continue;
      characters.push({
        name: c.name,
        reason: readiness === "no_node" ? "no_node" : "not_generated",
      });
    }
    if (characters.length) {
      gaps.push({ frameIndex: f.frameIndex, characters });
    }
  }

  return gaps;
}

/** @deprecated 使用 findStoryboardFramesMissingThreeView */
export function findMissingThreeViewForStoryboardFrames(args: {
  markdown: string;
  nodes: CanvasFlowNode[];
  onlyFrameIndices?: number[];
}): string[] {
  const names = new Set<string>();
  for (const g of findStoryboardFramesMissingThreeView(args)) {
    for (const c of g.characters) names.add(c.name);
  }
  return Array.from(names);
}

export function batchCreateThreeView(args: BatchArgs) {
  const chars = parseCharacterRows(args.markdown).filter(
    (c) =>
      !args.onlyCharacterNames?.length ||
      args.onlyCharacterNames.includes(c.name),
  );
  if (!chars.length) return;
  const nodes = liveNodes(args);
  const groupId = findCharacterGroupId(nodes);
  let rowY = groupId ? nextFrameRowY(nodes, groupId) : 0;
  const base = sourcePosition(nodes, args.sourceNodeId);
  const imageDefaults = args.imageDefaults;

  chars.forEach((c) => {
    if (hasCharacterThreeView(liveNodes(args), c.name)) return;

    const descText = `[${c.name}] ${c.appearance}`;
    const tvPrompt = `${THREE_VIEW_ENGINE_PROMPT_DEFAULT}\n\n【角色】${c.name}（${c.role}）\n【外观】${c.appearance}`;
    const tvData = {
      prompt: tvPrompt,
      characterName: c.name,
      params: {
        aspect_ratio: "16:9",
        resolution: "2K",
        output_format: "png",
        ...(imageDefaults?.params ?? {}),
      },
      ...(imageDefaults ?? {}),
    };

    let refId: string;
    let tvId: string;

    if (groupId) {
      refId = placeInGroup(args, groupId, 24, rowY, "text", {
        text: descText,
        mode: "manual",
      });
      tvId = placeInGroup(args, groupId, 260, rowY, "three-view-engine", tvData);
    } else {
      refId = args.addNode("text", { x: base.x + 320, y: base.y + rowY }, {
        text: descText,
        mode: "manual",
      });
      tvId = args.addNode(
        "three-view-engine",
        { x: base.x + 520, y: base.y + rowY },
        tvData,
      );
    }

    connectEdge(args.setEdges, args.sourceNodeId, refId, "text", "in_text");
    connectEdge(args.setEdges, refId, tvId, "text", "in_text");

    rowY += groupId ? 300 : 320;
  });
}

export function batchCreateFrameImages(args: BatchArgs) {
  const frames = parseStoryboardRows(args.markdown).filter(
    (f) =>
      !args.onlyFrameIndices?.length ||
      args.onlyFrameIndices.includes(f.frameIndex),
  );
  if (!frames.length) return;
  const nodes = liveNodes(args);
  const charRows = parseCharacterRows(findCharacterMarkdown(nodes));
  const groupId = findMediaGroupId(nodes);
  let rowY = groupId ? nextFrameRowY(nodes, groupId) : 0;
  const imageDefaults = args.imageDefaults;

  frames.forEach((f) => {
    if (hasFrameNode(liveNodes(args), "image-engine", f.frameIndex)) return;

    const bundle = buildFrameImagePromptBundle({
      frame: f,
      charRows,
      nodes: liveNodes(args),
      storyboardNodeId: args.sourceNodeId,
    });

    const imgData = {
      prompt: bundle.prompt,
      referencedNodeIds: bundle.referencedNodeIds,
      frameIndex: f.frameIndex,
      frameVideoPrompt: f.videoPrompt?.trim() || undefined,
      frameDialogue: f.dialogue?.trim() || undefined,
      params: {
        aspect_ratio: "16:9",
        resolution: "2K",
        output_format: "png",
        ...(imageDefaults?.params ?? {}),
      },
      ...(imageDefaults ?? {}),
    };
    const imgId = groupId
      ? placeInGroup(args, groupId, 24, rowY, "image-engine", imgData)
      : args.addNode(
          "image-engine",
          {
            x: sourcePosition(liveNodes(args), args.sourceNodeId).x + 480,
            y: rowY,
          },
          imgData,
        );

    connectEdge(args.setEdges, args.sourceNodeId, imgId, "text", "in_text");

    for (const tvId of bundle.tvIds) {
      connectEdge(args.setEdges, tvId, imgId, "image", "in_image");
    }

    rowY += 280;
  });
}

/** 为已存在的分镜图节点补连角色三视图、写入 @ 引用与 prompt */
export function wireFrameImageCharacterRefs(
  args: BatchArgs & {
    updateNodeData?: (id: string, patch: Record<string, unknown>) => void;
  },
) {
  const frames = parseStoryboardRows(args.markdown).filter(
    (f) =>
      !args.onlyFrameIndices?.length ||
      args.onlyFrameIndices.includes(f.frameIndex),
  );
  if (!frames.length) return;
  const nodes = liveNodes(args);
  const charRows = parseCharacterRows(findCharacterMarkdown(nodes));

  for (const f of frames) {
    const imgNode = nodes.find(
      (n) =>
        n.type === "image-engine" &&
        (n.data as { frameIndex?: number }).frameIndex === f.frameIndex,
    );
    if (!imgNode) continue;

    const bundle = buildFrameImagePromptBundle({
      frame: f,
      charRows,
      nodes,
      storyboardNodeId: args.sourceNodeId,
    });

    args.updateNodeData?.(imgNode.id, {
      prompt: bundle.prompt,
      referencedNodeIds: bundle.referencedNodeIds,
      frameVideoPrompt: f.videoPrompt?.trim() || undefined,
      frameDialogue: f.dialogue?.trim() || undefined,
    });

    for (const tvId of bundle.tvIds) {
      connectEdge(args.setEdges, tvId, imgNode.id, "image", "in_image");
    }
  }
}

export function batchCreateFrameVideos(args: BatchArgs) {
  const frames = parseStoryboardRows(args.markdown).filter(
    (f) =>
      !args.onlyFrameIndices?.length ||
      args.onlyFrameIndices.includes(f.frameIndex),
  );
  if (!frames.length) return;
  const nodes = liveNodes(args);
  const groupId = findMediaGroupId(nodes);
  const exportId = findExportNodeId(nodes);
  const videoDefaults = args.videoDefaults;

  frames.forEach((f) => {
    if (hasFrameNode(liveNodes(args), "video-engine", f.frameIndex)) return;
    const imgNode = liveNodes(args).find(
      (n) =>
        n.type === "image-engine" &&
        (n.data as { frameIndex?: number }).frameIndex === f.frameIndex,
    );
    const prompt = f.videoPrompt || STORY_VIDEO_ENGINE_PROMPT_DEFAULT;

    const vidData = {
      prompt,
      frameIndex: f.frameIndex,
      params: {
        resolution: "1080p",
        duration: 5,
        ...(videoDefaults?.params ?? {}),
      },
      ...(videoDefaults ?? {}),
    };

    let vidId: string;
    if (groupId && imgNode?.parentId === groupId) {
      vidId = placeInGroup(
        args,
        groupId,
        imgNode.position.x + 396,
        imgNode.position.y,
        "video-engine",
        vidData,
      );
    } else if (groupId) {
      const rowY = nextFrameRowY(liveNodes(args), groupId);
      vidId = placeInGroup(args, groupId, 420, rowY, "video-engine", vidData);
    } else {
      const base = sourcePosition(liveNodes(args), args.sourceNodeId);
      vidId = args.addNode(
        "video-engine",
        { x: base.x + 880, y: base.y },
        vidData,
      );
    }

    connectEdge(args.setEdges, args.sourceNodeId, vidId, "text", "in_text");
    if (imgNode) {
      connectEdge(args.setEdges, imgNode.id, vidId, "image", "in_image");
    }
    if (exportId) {
      connectEdge(args.setEdges, vidId, exportId, "video", "in_video");
    }
  });
}

export function batchCreateFrameTts(args: BatchArgs) {
  const frames = parseStoryboardRows(args.markdown);
  if (!frames.length) return;
  const nodes = liveNodes(args);
  const groupId = findMediaGroupId(nodes);
  const exportId = findExportNodeId(nodes);

  frames.forEach((f) => {
    const dialogue = f.dialogue.trim();
    if (!dialogue || dialogue === "—" || dialogue === "-") return;
    if (hasFrameNode(liveNodes(args), "tts-engine", f.frameIndex)) return;

    const imgNode = liveNodes(args).find(
      (n) =>
        n.type === "image-engine" &&
        (n.data as { frameIndex?: number }).frameIndex === f.frameIndex,
    );
    const rowY =
      imgNode?.parentId === groupId
        ? imgNode.position.y + 164
        : groupId
          ? nextFrameRowY(liveNodes(args), groupId) + 164
          : 0;

    const ttsId = groupId
      ? placeInGroup(args, groupId, imgNode?.position.x ?? 24, rowY, "tts-engine", {
          text: dialogue,
          frameIndex: f.frameIndex,
          params: { voice: "alloy" },
        })
      : args.addNode(
          "tts-engine",
          {
            x: sourcePosition(liveNodes(args), args.sourceNodeId).x + 480,
            y: rowY,
          },
          {
            text: dialogue,
            frameIndex: f.frameIndex,
            params: { voice: "alloy" },
          },
        );

    connectEdge(args.setEdges, args.sourceNodeId, ttsId, "text", "in_text");

    if (exportId) {
      connectEdge(args.setEdges, ttsId, exportId, "audio", "in_storyboard");
    }
  });
}

/** 从分镜引擎 + 各镜节点收集导出帧 */
export function collectJianyingFrames(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  storyboardNodeId: string,
): Array<{
  frameIndex: number;
  dialogue: string;
  videoUrl?: string;
  audioUrl?: string;
}> {
  const sb = nodes.find((n) => n.id === storyboardNodeId);
  const md =
    (sb?.data as { runtime?: { textOutput?: string } })?.runtime?.textOutput ??
    "";
  const rows = parseStoryboardRows(md);

  return rows.map((row) => {
    const videoNode = nodes.find(
      (n) =>
        n.type === "video-engine" &&
        (n.data as { frameIndex?: number }).frameIndex === row.frameIndex,
    );
    const ttsNode = nodes.find(
      (n) =>
        n.type === "tts-engine" &&
        (n.data as { frameIndex?: number }).frameIndex === row.frameIndex,
    );
    return {
      frameIndex: row.frameIndex,
      dialogue: row.dialogue,
      videoUrl: (videoNode?.data as { runtime?: { ossUrl?: string } })?.runtime
        ?.ossUrl,
      audioUrl: (ttsNode?.data as { runtime?: { ossUrl?: string } })?.runtime
        ?.ossUrl,
    };
  });
}

export function findUpstreamStoryboardId(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  exportNodeId: string,
): string | null {
  for (const pid of directPredecessors(edges, exportNodeId)) {
    const p = nodes.find((n) => n.id === pid);
    if (p?.type === "storyboard-engine") return p.id;
  }
  const any = nodes.find((n) => n.type === "storyboard-engine");
  return any?.id ?? null;
}

export function findStoryboardEngineForNode(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): CanvasFlowNode | undefined {
  const visited = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    for (const pid of directPredecessors(edges, cur)) {
      const p = nodes.find((n) => n.id === pid);
      if (p?.type === "storyboard-engine") return p;
      queue.push(pid);
    }
  }
  return nodes.find((n) => n.type === "storyboard-engine");
}

function storyboardRowForFrame(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  imageEngineId: string,
  frameIndex: number,
) {
  const sb = findStoryboardEngineForNode(nodes, edges, imageEngineId);
  const md = String(
    (sb?.data as { runtime?: { textOutput?: string } })?.runtime?.textOutput ??
      "",
  );
  return parseStoryboardRows(md).find((r) => r.frameIndex === frameIndex);
}

/** 分镜图节点 · 视频提示 / 对白：优先节点字段，缺省回退分镜表 Markdown。 */
export function resolveFrameMediaForImage(args: {
  imgData: ImageEngineNodeData;
  nodes: CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  imageEngineId: string;
}): {
  /** 供 TTS / 展示：节点或分镜表真实对白 */
  dialogue: string;
  /** 供展示：节点或分镜表真实视频提示（不含默认模板） */
  videoPromptDisplay: string;
  /** 供视频引擎 spawn：含默认模板兜底 */
  videoPrompt: string;
} {
  const fi = args.imgData.frameIndex;
  const row =
    fi != null
      ? storyboardRowForFrame(
          args.nodes,
          args.edges,
          args.imageEngineId,
          fi,
        )
      : undefined;
  const videoFromSource =
    args.imgData.frameVideoPrompt?.trim() || row?.videoPrompt?.trim() || "";
  return {
    dialogue: resolveFrameDialogue(args.imgData, row),
    videoPromptDisplay: videoFromSource,
    videoPrompt: resolveFrameVideoPrompt(args.imgData, row),
  };
}

function findFrameNodeId(
  nodes: CanvasFlowNode[],
  type: CanvasNodeType,
  frameIndex: number,
): string | undefined {
  return nodes.find(
    (n) =>
      n.type === type &&
      (n.data as { frameIndex?: number }).frameIndex === frameIndex,
  )?.id;
}

export type FrameMediaSpawnArgs = {
  imageEngineId: string;
  nodes: CanvasFlowNode[];
  getNodes?: () => CanvasFlowNode[];
  edges: CanvasFlowEdge[];
  addNode: StoreAddNode;
  addNodeInGroup?: BatchArgs["addNodeInGroup"];
  setEdges: BatchArgs["setEdges"];
  reparentNode?: BatchArgs["reparentNode"];
  updateNodeData?: (id: string, patch: Record<string, unknown>) => void;
  videoPick?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
  ttsPick?: {
    providerId: string;
    modelKey: string;
    params?: Record<string, unknown>;
  };
};

function toBatchArgs(args: FrameMediaSpawnArgs, storyboardId: string): BatchArgs {
  return {
    sourceNodeId: storyboardId,
    markdown: "",
    nodes: args.nodes,
    getNodes: args.getNodes,
    edges: args.edges,
    addNode: args.addNode,
    addNodeInGroup: args.addNodeInGroup,
    setEdges: args.setEdges,
    reparentNode: args.reparentNode,
  };
}

function resolveFrameVideoPrompt(
  imgData: ImageEngineNodeData,
  row?: { videoPrompt: string },
): string {
  return (
    imgData.frameVideoPrompt?.trim() ||
    row?.videoPrompt?.trim() ||
    STORY_VIDEO_ENGINE_PROMPT_DEFAULT
  );
}

function resolveFrameDialogue(
  imgData: ImageEngineNodeData,
  row?: { dialogue: string },
): string {
  const d = imgData.frameDialogue?.trim() || row?.dialogue?.trim() || "";
  if (!d || d === "—" || d === "-") return "";
  return d;
}

function syncFrameVideoNode(
  args: FrameMediaSpawnArgs,
  vidId: string,
  imgNode: CanvasFlowNode,
  fi: number,
  prompt: string,
  pick?: FrameMediaSpawnArgs["videoPick"],
) {
  args.updateNodeData?.(vidId, {
    prompt,
    frameIndex: fi,
    ...(pick?.providerId && pick.modelKey
      ? {
          providerId: pick.providerId,
          modelKey: pick.modelKey,
          params: pick.params ?? {},
        }
      : {}),
  });
  const sb = findStoryboardEngineForNode(
    liveNodes(args as unknown as BatchArgs),
    args.edges,
    args.imageEngineId,
  );
  if (sb) {
    connectEdge(args.setEdges, sb.id, vidId, "text", "in_text");
  }
  connectEdge(args.setEdges, imgNode.id, vidId, "image", "in_image");
}

/** 为单个分镜图节点创建（或返回已有）视频引擎 */
export function spawnFrameVideoForImage(
  args: FrameMediaSpawnArgs,
): string | null {
  const nodes = liveNodes(args as unknown as BatchArgs);
  const imgNode = nodes.find((n) => n.id === args.imageEngineId);
  if (!imgNode || imgNode.type !== "image-engine") return null;
  const imgData = imgNode.data as ImageEngineNodeData;
  const fi = imgData.frameIndex;
  if (fi == null) return null;

  const sb = findStoryboardEngineForNode(nodes, args.edges, args.imageEngineId);
  if (!sb) return null;
  const md =
    (sb.data as { runtime?: { textOutput?: string } }).runtime?.textOutput ??
    "";
  const row = parseStoryboardRows(md).find((r) => r.frameIndex === fi);
  const prompt = resolveFrameVideoPrompt(imgData, row);
  const pick = args.videoPick ?? imgData.frameVideo;

  const existing = findFrameNodeId(nodes, "video-engine", fi);
  if (existing) {
    syncFrameVideoNode(args, existing, imgNode, fi, prompt, pick);
    return existing;
  }

  const batch = toBatchArgs(args, sb.id);
  const groupId = findMediaGroupId(nodes);
  const exportId = findExportNodeId(nodes);
  const videoData = {
    prompt,
    frameIndex: fi,
    params: pick?.params ?? { resolution: "1080p", duration: 5 },
    ...(pick?.providerId && pick.modelKey
      ? {
          providerId: pick.providerId,
          modelKey: pick.modelKey,
        }
      : {}),
  };

  let vidId: string;
  if (groupId && imgNode.parentId === groupId) {
    vidId = placeInGroup(batch, groupId, imgNode.position.x + 396, imgNode.position.y, "video-engine", videoData);
  } else if (groupId) {
    const rowY = nextFrameRowY(nodes, groupId);
    vidId = placeInGroup(batch, groupId, 420, rowY, "video-engine", videoData);
  } else {
    const base = imgNode.position;
    vidId = args.addNode("video-engine", { x: base.x + 400, y: base.y }, videoData);
  }

  connectEdge(args.setEdges, sb.id, vidId, "text", "in_text");
  connectEdge(args.setEdges, imgNode.id, vidId, "image", "in_image");
  if (exportId) {
    connectEdge(args.setEdges, vidId, exportId, "video", "in_video");
  }
  return vidId;
}

/** 为单个分镜图节点创建（或返回已有）TTS 引擎 */
export function spawnFrameTtsForImage(
  args: FrameMediaSpawnArgs,
): string | null {
  const nodes = liveNodes(args as unknown as BatchArgs);
  const imgNode = nodes.find((n) => n.id === args.imageEngineId);
  if (!imgNode || imgNode.type !== "image-engine") return null;
  const imgData = imgNode.data as ImageEngineNodeData;
  const fi = imgData.frameIndex;
  if (fi == null) return null;

  const sb = findStoryboardEngineForNode(nodes, args.edges, args.imageEngineId);
  if (!sb) return null;
  const md =
    (sb.data as { runtime?: { textOutput?: string } }).runtime?.textOutput ??
    "";
  const row = parseStoryboardRows(md).find((r) => r.frameIndex === fi);
  const dialogue = resolveFrameDialogue(imgData, row);
  if (!dialogue) return null;

  const pick = args.ttsPick ?? imgData.frameTts;

  const existing = findFrameNodeId(nodes, "tts-engine", fi);
  if (existing) {
    args.updateNodeData?.(existing, {
      text: dialogue,
      frameIndex: fi,
      ...(pick?.providerId && pick.modelKey
        ? {
            providerId: pick.providerId,
            modelKey: pick.modelKey,
            params: pick.params ?? {},
          }
        : {}),
    });
    connectEdge(args.setEdges, sb.id, existing, "text", "in_text");
    return existing;
  }

  const batch = toBatchArgs(args, sb.id);
  const groupId = findMediaGroupId(nodes);
  const exportId = findExportNodeId(nodes);
  const ttsData = {
    text: dialogue,
    frameIndex: fi,
    params: pick?.params ?? { voice: "alloy" },
    ...(pick?.providerId && pick.modelKey
      ? {
          providerId: pick.providerId,
          modelKey: pick.modelKey,
        }
      : {}),
  };
  const rowY =
    imgNode.parentId === groupId
      ? imgNode.position.y + 164
      : groupId
        ? nextFrameRowY(nodes, groupId) + 164
        : imgNode.position.y + 200;

  const ttsId = groupId
    ? placeInGroup(batch, groupId, imgNode.position.x, rowY, "tts-engine", ttsData)
    : args.addNode(
        "tts-engine",
        { x: imgNode.position.x, y: rowY },
        ttsData,
      );

  connectEdge(args.setEdges, sb.id, ttsId, "text", "in_text");
  if (exportId) {
    connectEdge(args.setEdges, ttsId, exportId, "audio", "in_storyboard");
  }
  return ttsId;
}
