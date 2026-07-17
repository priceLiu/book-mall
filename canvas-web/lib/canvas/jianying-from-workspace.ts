import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import { resolveLibtvVideoPosterUrl } from "./libtv-video-poster";
import type {
  StoryFrameColumnNodeData,
  StoryFrameRow,
  StoryVideoColumnNodeData,
  StoryVideoRow,
  StoryWorkspaceIds,
} from "./story-workspace-types";

const LIBTV_VIDEO_SOURCE_TYPES = new Set([
  "sbv1-video-engine",
  "video-engine",
  "ai-video-engine",
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

function dialogueFromConnectedVideoNode(node: CanvasFlowNode): string | undefined {
  const p = (node.data as { prompt?: string }).prompt?.trim();
  return p || undefined;
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

export type JianyingLibtvConnectionSnapshot = {
  /** in_video 入边 · 视频类源节点总数（含未生成） */
  connectedCount: number;
  /** 其中已有 oss / ephemeral 视频 URL 的数量 */
  renderedCount: number;
  /** 全部入边镜头（含顺序 · 含未成片） */
  clipSlots: JianyingLibtvClipSlot[];
  /** 当前顺序（源节点 id 列表） */
  orderNodeIds: string[];
  /** 仅含成片的导出帧（ZIP / 自动剪辑用 · 已按 clipSlots 顺序） */
  frames: JianyingFrameExport[];
};

/** 导出剪辑 · LibTV 连线快照（连线数 + 成片数 + 顺序） */
export function collectJianyingLibtvConnectionSnapshot(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  savedClipOrderNodeIds?: string[],
): JianyingLibtvConnectionSnapshot {
  const videoNodes = incomingLibtvVideoNodes(exportNodeId, nodes, edges);
  const orderNodeIds = mergeLibtvClipOrderNodeIds(
    savedClipOrderNodeIds,
    videoNodes,
    nodes,
    edges,
  );
  const nodeById = new Map(videoNodes.map((n) => [n.id, n]));

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
      dialogue: dialogueFromConnectedVideoNode(node),
      hasVideo: Boolean(videoUrl),
    });
  });

  const frames: JianyingFrameExport[] = clipSlots
    .filter((s) => s.hasVideo)
    .map((s, i) => ({
      frameIndex: i + 1,
      sourceNodeId: s.sourceNodeId,
      videoUrl: s.videoUrl,
      dialogue: s.dialogue,
    }));

  return {
    connectedCount: clipSlots.length,
    renderedCount: frames.length,
    clipSlots,
    orderNodeIds,
    frames,
  };
}

/** 从剪映导出节点 in_video 入边收集 LibTV / 画布视频节点（仅成片） */
export function collectJianyingFramesFromLibtvVideos(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  savedClipOrderNodeIds?: string[],
): JianyingFrameExport[] {
  return collectJianyingLibtvConnectionSnapshot(
    exportNodeId,
    nodes,
    edges,
    savedClipOrderNodeIds,
  ).frames;
}

/** 优先 LibTV 连线视频；无连线时回退 Pro2 工作区视频列 */
export function collectJianyingFramesForExportNode(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  ws?: Pick<StoryWorkspaceIds, "frameColumnId" | "videoColumnId"> | null,
  savedClipOrderNodeIds?: string[],
): JianyingFrameExport[] {
  const libtv = collectJianyingFramesFromLibtvVideos(
    exportNodeId,
    nodes,
    edges,
    savedClipOrderNodeIds,
  );
  if (libtv.length) return libtv;
  if (ws) return collectJianyingFramesFromWorkspace(nodes, ws);
  return [];
}
