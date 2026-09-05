import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { resolveLibtvAudioHttpsExportUrlFromNode, resolveLibtvAudioMixReadiness, resolveLibtvAudioLocalPreviewUrl } from "./libtv-audio-export-url";
import { resolveLibtvVideoPosterUrl } from "./libtv-video-poster";
import { parseStoryboardRows } from "./parse-md-tables";
import { resolveSbv1UpstreamTextLinks } from "./sbv1-upstream-text-links";
import { resolveHubStoryboardMd } from "./story-hub-runtime";
import { normalizeSubtitleBurnInText } from "./subtitle-burn-in";
import type {
  StoryFrameColumnNodeData,
  StoryFrameRow,
  StoryScriptHubNodeData,
  StoryVideoColumnNodeData,
  StoryVideoRow,
  StoryWorkspaceIds,
} from "./story-workspace-types";

const LIBTV_VIDEO_SOURCE_TYPES = new Set([
  "sbv1-video-engine",
  "video-engine",
  "ai-video-engine",
]);

const LIBTV_AUDIO_SOURCE_TYPES = new Set(["story-pro2-audio"]);

const SCRIPT_HUB_NODE_TYPES = new Set([
  "story-pro2-script-hub",
  "story-script-hub",
]);

function nodeFlowSortPosition(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    parentId = parent.parentId;
  }
  return { x, y };
}

function compareNodeCanvasOrder(
  a: CanvasFlowNode,
  b: CanvasFlowNode,
  nodes: CanvasFlowNode[],
): number {
  const pa = nodeFlowSortPosition(a, nodes);
  const pb = nodeFlowSortPosition(b, nodes);
  if (pa.y !== pb.y) return pa.y - pb.y;
  if (pa.x !== pb.x) return pa.x - pb.x;
  return a.id.localeCompare(b.id);
}

function videoUrlFromConnectedNode(node: CanvasFlowNode): string | undefined {
  const d = node.data as {
    runtime?: { ossUrl?: string; ephemeralUrl?: string };
  };
  return (
    d.runtime?.ossUrl?.trim() ||
    d.runtime?.ephemeralUrl?.trim() ||
    undefined
  );
}

function audioUrlFromConnectedNode(node: CanvasFlowNode): string | undefined {
  return resolveLibtvAudioHttpsExportUrlFromNode(node);
}

function dialogueFromAudioNode(node: CanvasFlowNode): string | undefined {
  const d = node.data as { dockInput?: string; label?: string };
  const fromDock = normalizeSubtitleBurnInText(d.dockInput);
  if (fromDock) return fromDock;
  return normalizeSubtitleBurnInText(d.label);
}
function clipLabelFromAudioNode(node: CanvasFlowNode): string {
  const d = node.data as {
    label?: string;
    crewTaskLabel?: string;
    dockInput?: string;
  };
  const dialogue = String(d.dockInput ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (dialogue) {
    return dialogue.length > 48 ? `${dialogue.slice(0, 47)}…` : dialogue;
  }
  return d.label?.trim() || d.crewTaskLabel?.trim() || "音频";
}

function dialogueFromConnectedVideoNode(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string | undefined {
  const d = node.data as {
    frameDialogue?: string;
    prompt?: string;
    text?: string;
  };
  const fromSelf = normalizeSubtitleBurnInText(d.frameDialogue ?? d.text);
  if (fromSelf) return fromSelf;

  const inImageEdge = edges.find(
    (e) =>
      e.target === node.id &&
      (e.targetHandle === "in_image" ||
        e.targetHandle?.includes("image") ||
        e.sourceHandle === "image"),
  );
  if (inImageEdge) {
    const img = nodes.find((n) => n.id === inImageEdge.source);
    if (img) {
      const fromImg = normalizeSubtitleBurnInText(
        (img.data as { frameDialogue?: string }).frameDialogue,
      );
      if (fromImg) return fromImg;
    }
  }

  const prompt = d.prompt?.trim();
  if (prompt && prompt.length <= 160) {
    return normalizeSubtitleBurnInText(prompt) || undefined;
  }
  return undefined;
}

function upstreamImageNode(
  videoNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode | undefined {
  const inImageEdge = edges.find(
    (e) =>
      e.target === videoNodeId &&
      (e.targetHandle === "in_image" ||
        e.targetHandle?.includes("image") ||
        e.sourceHandle === "image"),
  );
  if (!inImageEdge) return undefined;
  return nodes.find((n) => n.id === inImageEdge.source);
}

function resolveFrameIndexForVideoNode(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  clipSequence?: number,
): number | undefined {
  const d = node.data as { frameIndex?: number };
  if (typeof d.frameIndex === "number" && d.frameIndex > 0) {
    return d.frameIndex;
  }
  const img = upstreamImageNode(node.id, nodes, edges);
  if (img) {
    const fi = (img.data as { frameIndex?: number }).frameIndex;
    if (typeof fi === "number" && fi > 0) return fi;
  }
  if (clipSequence != null && clipSequence > 0) return clipSequence;
  return undefined;
}

function dialogueFromStoryboardMdByFrameIndex(
  md: string,
  frameIndex: number,
): string | undefined {
  if (!md.trim() || frameIndex <= 0) return undefined;
  const row = parseStoryboardRows(md).find((r) => r.frameIndex === frameIndex);
  if (!row?.dialogue?.trim()) return undefined;
  return normalizeSubtitleBurnInText(row.dialogue);
}

/** 从脚本中心分镜表按镜号取对白（视频节点未写入 frameDialogue 时的回退） */
export function dialogueFromScriptHubByFrameIndex(
  nodes: CanvasFlowNode[],
  frameIndex: number,
): string | undefined {
  if (frameIndex <= 0) return undefined;
  for (const node of nodes) {
    if (!SCRIPT_HUB_NODE_TYPES.has(node.type ?? "")) continue;
    const md = resolveHubStoryboardMd(
      node.data as unknown as StoryScriptHubNodeData,
    );
    const text = dialogueFromStoryboardMdByFrameIndex(md, frameIndex);
    if (text) return text;
  }
  return undefined;
}

/** sbv1 视频 · in_text 上游文本/脚本表按剪辑顺序取对白 */
function dialogueFromSbv1UpstreamText(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  clipSequence?: number,
): string | undefined {
  if ((node.type ?? "") !== "sbv1-video-engine") return undefined;
  const frameIndex =
    resolveFrameIndexForVideoNode(node, nodes, edges, clipSequence) ??
    clipSequence ??
    1;
  const links = resolveSbv1UpstreamTextLinks(node.id, nodes, edges);
  for (const link of links) {
    const source = nodes.find((n) => n.id === link.sourceNodeId);
    if (source?.type === "story-pro2-script-hub") {
      const md = resolveHubStoryboardMd(
        source.data as unknown as StoryScriptHubNodeData,
      );
      const fromHub = dialogueFromStoryboardMdByFrameIndex(md, frameIndex);
      if (fromHub) return fromHub;
    }
    const fromLinkText = dialogueFromStoryboardMdByFrameIndex(
      link.fullText,
      frameIndex,
    );
    if (fromLinkText) return fromLinkText;
    const normalized = normalizeSubtitleBurnInText(link.fullText);
    if (normalized) return normalized;
  }
  return undefined;
}

export function resolveClipDialogue(
  node: CanvasFlowNode,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  clipSequence?: number,
): string | undefined {
  const fromNode = dialogueFromConnectedVideoNode(node, nodes, edges);
  if (fromNode) return fromNode;
  const fromSbv1Text = dialogueFromSbv1UpstreamText(
    node,
    nodes,
    edges,
    clipSequence,
  );
  if (fromSbv1Text) return fromSbv1Text;
  const frameIndex = resolveFrameIndexForVideoNode(
    node,
    nodes,
    edges,
    clipSequence,
  );
  if (frameIndex == null) return undefined;
  return dialogueFromScriptHubByFrameIndex(nodes, frameIndex);
}

export function clipLabelFromVideoNode(node: CanvasFlowNode): string {
  const d = node.data as {
    label?: string;
    crewTaskLabel?: string;
    prompt?: string;
  };
  return (
    d.label?.trim() ||
    d.crewTaskLabel?.trim() ||
    d.prompt?.trim()?.slice(0, 24) ||
    "视频"
  );
}

export type JianyingFrameExport = {
  frameIndex: number;
  videoUrl?: string;
  audioUrl?: string;
  dialogue?: string;
  /** 连线源节点 id · 用于剪辑顺序持久化 */
  sourceNodeId?: string;
  /** 配对配音节点 id · 提交时服务端自动落 OSS */
  audioSourceNodeId?: string;
};

export type JianyingLibtvClipSlot = {
  sourceNodeId: string;
  /** 1-based · 当前剪辑顺序 */
  sequence: number;
  label: string;
  videoUrl?: string;
  /** 封面 / 参考图 · 顺序条缩略图 */
  posterUrl?: string;
  dialogue?: string;
  hasVideo: boolean;
};

export type JianyingLibtvAudioClipSlot = {
  sourceNodeId: string;
  sequence: number;
  label: string;
  audioUrl?: string;
  /** HTTPS · 云端可混入 */
  hasAudio: boolean;
  /** 含 data:/blob: · 节点已生成但 OSS 可能仍在同步 */
  hasLocalPreview: boolean;
  /** 顺序条试听（含本地预览） */
  previewUrl?: string;
};

/** 从分镜脚本行 + 视频列行收集可打包的镜位（至少含视频或配音） */
export function collectJianyingFramesFromColumns(
  frameRows: StoryFrameRow[],
  videoRows: StoryVideoRow[],
): JianyingFrameExport[] {
  const indices = new Set<number>();
  for (const r of frameRows) indices.add(r.frameIndex);
  for (const r of videoRows) indices.add(r.frameIndex);

  return Array.from(indices)
    .sort((a, b) => a - b)
    .map((frameIndex) => {
      const fr = frameRows.find((r) => r.frameIndex === frameIndex);
      const vr = videoRows.find((r) => r.frameIndex === frameIndex);
      return {
        frameIndex,
        videoUrl:
          vr?.videoRuntime?.ossUrl ??
          vr?.videoRuntime?.ephemeralUrl ??
          undefined,
        audioUrl:
          vr?.ttsRuntime?.ossUrl ?? vr?.ttsRuntime?.ephemeralUrl ?? undefined,
        dialogue: fr?.dialogue ?? vr?.dialogue,
      };
    })
    .filter((f) => f.videoUrl || f.audioUrl);
}

export function collectJianyingFramesFromWorkspace(
  nodes: CanvasFlowNode[],
  ws: Pick<StoryWorkspaceIds, "frameColumnId" | "videoColumnId">,
): JianyingFrameExport[] {
  const frameCol = ws.frameColumnId
    ? nodes.find((n) => n.id === ws.frameColumnId)
    : undefined;
  const videoCol = ws.videoColumnId
    ? nodes.find((n) => n.id === ws.videoColumnId)
    : undefined;
  if (!frameCol && !videoCol) return [];

  const frameRows = (frameCol?.data as StoryFrameColumnNodeData)?.rows ?? [];
  const videoRows = (videoCol?.data as StoryVideoColumnNodeData)?.rows ?? [];
  return collectJianyingFramesFromColumns(frameRows, videoRows);
}

function incomingLibtvVideoNodes(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const incoming = edges.filter(
    (e) =>
      e.target === exportNodeId &&
      (!e.targetHandle ||
        e.targetHandle === "in_video" ||
        e.targetHandle === "in_storyboard"),
  );

  return incoming
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter(
      (n): n is CanvasFlowNode =>
        !!n && LIBTV_VIDEO_SOURCE_TYPES.has(n.type ?? ""),
    );
}

function incomingLibtvAudioNodes(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  const incoming = edges.filter((e) => {
    if (e.target !== exportNodeId) return false;
    const src = nodes.find((n) => n.id === e.source);
    const isAudio =
      !!src && LIBTV_AUDIO_SOURCE_TYPES.has(src.type ?? "");
    if (isAudio) {
      // 误连到 in_video（上侧入点）时仍识别为配音
      return (
        !e.targetHandle ||
        e.targetHandle === "in_audio" ||
        e.targetHandle === "in_video"
      );
    }
    return e.targetHandle === "in_audio";
  });
  return incoming
    .map((e) => nodes.find((n) => n.id === e.source))
    .filter(
      (n): n is CanvasFlowNode =>
        !!n && LIBTV_AUDIO_SOURCE_TYPES.has(n.type ?? ""),
    );
}

/** 按视频剪辑顺序对齐第 N 镜配音（与 frames[i].audioUrl 规则一致） */
export function pairAudioSlotsToVideoOrder(
  videoOrderNodeIds: readonly string[],
  audioOrderNodeIds: readonly string[],
  audioClipSlots: readonly JianyingLibtvAudioClipSlot[],
): (JianyingLibtvAudioClipSlot | undefined)[] {
  const audioById = new Map(audioClipSlots.map((s) => [s.sourceNodeId, s]));
  return videoOrderNodeIds.map((_, index) => {
    const audioId = audioOrderNodeIds[index];
    return audioId ? audioById.get(audioId) : undefined;
  });
}

/** 默认顺序：优先 out_video 串联链，其次画布 Y→X */
export function sortLibtvVideoNodesDefault(
  videoNodes: CanvasFlowNode[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): CanvasFlowNode[] {
  if (videoNodes.length <= 1) return [...videoNodes];

  const idSet = new Set(videoNodes.map((n) => n.id));
  const next = new Map<string, string>();
  const hasPrev = new Set<string>();

  for (const e of edges) {
    if (!idSet.has(e.source) || !idSet.has(e.target)) continue;
    if (e.sourceHandle && e.sourceHandle !== "out_video") continue;
    next.set(e.source, e.target);
    hasPrev.add(e.target);
  }

  const heads = videoNodes
    .filter((n) => !hasPrev.has(n.id))
    .sort((a, b) => compareNodeCanvasOrder(a, b, nodes));

  const ordered: CanvasFlowNode[] = [];
  const seen = new Set<string>();

  for (const head of heads) {
    let cur: CanvasFlowNode | undefined = head;
    while (cur && !seen.has(cur.id)) {
      ordered.push(cur);
      seen.add(cur.id);
      const nextId = next.get(cur.id);
      cur = nextId ? videoNodes.find((n) => n.id === nextId) : undefined;
    }
  }

  const rest = videoNodes
    .filter((n) => !seen.has(n.id))
    .sort((a, b) => compareNodeCanvasOrder(a, b, nodes));

  return [...ordered, ...rest];
}

export function mergeLibtvClipOrderNodeIds(
  savedOrder: string[] | undefined,
  videoNodes: CanvasFlowNode[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string[] {
  const currentIds = videoNodes.map((n) => n.id);
  const currentSet = new Set(currentIds);
  let order = (savedOrder ?? []).filter((id) => currentSet.has(id));
  const missing = currentIds.filter((id) => !order.includes(id));
  if (missing.length) {
    const missingNodes = videoNodes.filter((n) => missing.includes(n.id));
    order = [
      ...order,
      ...sortLibtvVideoNodesDefault(missingNodes, nodes, edges).map((n) => n.id),
    ];
  }
  if (!order.length) {
    order = sortLibtvVideoNodesDefault(videoNodes, nodes, edges).map((n) => n.id);
  }
  return order;
}

export function moveClipOrderNodeIds(
  order: string[],
  sourceNodeId: string,
  direction: -1 | 1,
): string[] {
  const index = order.indexOf(sourceNodeId);
  if (index < 0) return order;
  const target = index + direction;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

export function mergeLibtvAudioOrderNodeIds(
  savedOrder: string[] | undefined,
  audioNodes: CanvasFlowNode[],
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): string[] {
  const currentIds = audioNodes.map((n) => n.id);
  const currentSet = new Set(currentIds);
  let order = (savedOrder ?? []).filter((id) => currentSet.has(id));
  const missing = currentIds.filter((id) => !order.includes(id));
  if (missing.length) {
    const missingNodes = audioNodes.filter((n) => missing.includes(n.id));
    order = [
      ...order,
      ...sortLibtvVideoNodesDefault(missingNodes, nodes, edges).map((n) => n.id),
    ];
  }
  if (!order.length) {
    order = sortLibtvVideoNodesDefault(audioNodes, nodes, edges).map((n) => n.id);
  }
  return order;
}

export type JianyingLibtvConnectionSnapshot = {
  /** in_video 入边 · 视频类源节点总数（含未生成） */
  connectedCount: number;
  /** 其中已有 oss / ephemeral 视频 URL 的数量 */
  renderedCount: number;
  /** in_audio 入边 · 音频源节点总数 */
  audioConnectedCount: number;
  audioRenderedCount: number;
  /** 全部入边镜头（含顺序 · 含未成片） */
  clipSlots: JianyingLibtvClipSlot[];
  audioClipSlots: JianyingLibtvAudioClipSlot[];
  /** 当前顺序（源节点 id 列表） */
  orderNodeIds: string[];
  audioOrderNodeIds: string[];
  /** 仅含成片的导出帧（ZIP / 自动剪辑用 · 已按 clipSlots 顺序） */
  frames: JianyingFrameExport[];
};

/** 导出剪辑 · LibTV 连线快照（连线数 + 成片数 + 顺序） */
export function collectJianyingLibtvConnectionSnapshot(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  savedClipOrderNodeIds?: string[],
  savedAudioOrderNodeIds?: string[],
): JianyingLibtvConnectionSnapshot {
  const videoNodes = incomingLibtvVideoNodes(exportNodeId, nodes, edges);
  const audioNodes = incomingLibtvAudioNodes(exportNodeId, nodes, edges);
  const orderNodeIds = mergeLibtvClipOrderNodeIds(
    savedClipOrderNodeIds,
    videoNodes,
    nodes,
    edges,
  );
  const audioOrderNodeIds = mergeLibtvAudioOrderNodeIds(
    savedAudioOrderNodeIds,
    audioNodes,
    nodes,
    edges,
  );
  const nodeById = new Map(videoNodes.map((n) => [n.id, n]));
  const audioById = new Map(audioNodes.map((n) => [n.id, n]));

  const clipSlots: JianyingLibtvClipSlot[] = [];
  orderNodeIds.forEach((id, i) => {
    const node = nodeById.get(id);
    if (!node) return;
    const videoUrl = videoUrlFromConnectedNode(node);
    const runtime = (node.data as { runtime?: { posterUrl?: string } }).runtime;
    const posterUrl = resolveLibtvVideoPosterUrl({
      nodeId: id,
      runtime,
      nodes,
      edges,
    });
    clipSlots.push({
      sourceNodeId: id,
      sequence: i + 1,
      label: clipLabelFromVideoNode(node),
      videoUrl,
      posterUrl,
      dialogue: resolveClipDialogue(node, nodes, edges, i + 1),
      hasVideo: Boolean(videoUrl),
    });
  });

  const audioClipSlots: JianyingLibtvAudioClipSlot[] = [];
  audioOrderNodeIds.forEach((id, i) => {
    const node = audioById.get(id);
    if (!node) return;
    const audioUrl = audioUrlFromConnectedNode(node);
    const mix = resolveLibtvAudioMixReadiness(
      (node.data ?? {}) as {
        ossUrl?: string;
        blobUrl?: string;
        runtime?: { ossUrl?: string; ephemeralUrl?: string };
      },
    );
    audioClipSlots.push({
      sourceNodeId: id,
      sequence: i + 1,
      label: clipLabelFromAudioNode(node),
      audioUrl,
      previewUrl: resolveLibtvAudioLocalPreviewUrl(
        (node.data ?? {}) as {
          ossUrl?: string;
          blobUrl?: string;
          runtime?: { ossUrl?: string; ephemeralUrl?: string };
        },
      ),
      hasAudio: mix.exportReady,
      hasLocalPreview: mix.localPreview,
    });
  });

  const frames: JianyingFrameExport[] = clipSlots
    .filter((s) => s.hasVideo)
    .map((s, i) => {
      const pairedAudioId = audioOrderNodeIds[i];
      const pairedAudioNode = pairedAudioId
        ? audioById.get(pairedAudioId)
        : undefined;
      return {
        frameIndex: i + 1,
        sourceNodeId: s.sourceNodeId,
        audioSourceNodeId: pairedAudioId,
        videoUrl: s.videoUrl,
        audioUrl: audioClipSlots[i]?.hasAudio ? audioClipSlots[i]?.audioUrl : undefined,
        dialogue:
          s.dialogue ??
          (pairedAudioNode ? dialogueFromAudioNode(pairedAudioNode) : undefined),
      };
    });

  return {
    connectedCount: clipSlots.length,
    renderedCount: frames.length,
    audioConnectedCount: audioClipSlots.length,
    audioRenderedCount: audioClipSlots.filter((s) => s.hasAudio).length,
    clipSlots,
    audioClipSlots,
    orderNodeIds,
    audioOrderNodeIds,
    frames,
  };
}

/** 从剪映导出节点 in_video 入边收集 LibTV / 画布视频节点（仅成片） */
export function collectJianyingFramesFromLibtvVideos(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  savedClipOrderNodeIds?: string[],
  savedAudioOrderNodeIds?: string[],
): JianyingFrameExport[] {
  return collectJianyingLibtvConnectionSnapshot(
    exportNodeId,
    nodes,
    edges,
    savedClipOrderNodeIds,
    savedAudioOrderNodeIds,
  ).frames;
}

/** 优先 LibTV 连线视频；无连线时回退 Pro2 工作区视频列 */
export function collectJianyingFramesForExportNode(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  ws?: Pick<StoryWorkspaceIds, "frameColumnId" | "videoColumnId"> | null,
  savedClipOrderNodeIds?: string[],
  savedAudioOrderNodeIds?: string[],
): JianyingFrameExport[] {
  const libtv = collectJianyingFramesFromLibtvVideos(
    exportNodeId,
    nodes,
    edges,
    savedClipOrderNodeIds,
    savedAudioOrderNodeIds,
  );
  if (libtv.length) return libtv;
  if (ws) return collectJianyingFramesFromWorkspace(nodes, ws);
  return [];
}
