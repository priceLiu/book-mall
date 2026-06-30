import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
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

function nodeFlowSortX(node: CanvasFlowNode, nodes: CanvasFlowNode[]): number {
  let x = node.position.x;
  let parentId = node.parentId;
  while (parentId) {
    const parent = nodes.find((n) => n.id === parentId);
    if (!parent) break;
    x += parent.position.x;
    parentId = parent.parentId;
  }
  return x;
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

export type JianyingFrameExport = {
  frameIndex: number;
  videoUrl?: string;
  audioUrl?: string;
  dialogue?: string;
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
    )
    .sort((a, b) => {
      const ax = nodeFlowSortX(a, nodes);
      const bx = nodeFlowSortX(b, nodes);
      if (ax !== bx) return ax - bx;
      return a.id.localeCompare(b.id);
    });
}

export type JianyingLibtvConnectionSnapshot = {
  /** in_video 入边 · 视频类源节点总数（含未生成） */
  connectedCount: number;
  /** 其中已有 oss / ephemeral 视频 URL 的数量 */
  renderedCount: number;
  /** 仅含成片的导出帧（ZIP / 自动剪辑用） */
  frames: JianyingFrameExport[];
};

/** 导出剪辑 · LibTV 连线快照（连线数 + 成片数） */
export function collectJianyingLibtvConnectionSnapshot(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): JianyingLibtvConnectionSnapshot {
  const videoNodes = incomingLibtvVideoNodes(exportNodeId, nodes, edges);
  const slots = videoNodes.map((node, i) => ({
    frameIndex: i + 1,
    videoUrl: videoUrlFromConnectedNode(node),
    dialogue: dialogueFromConnectedVideoNode(node),
  }));
  const frames = slots.filter((f) => Boolean(f.videoUrl));
  return {
    connectedCount: slots.length,
    renderedCount: frames.length,
    frames,
  };
}

/** 从剪映导出节点 in_video 入边收集 LibTV / 画布视频节点（按 X 排序 · 仅成片） */
export function collectJianyingFramesFromLibtvVideos(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): JianyingFrameExport[] {
  return collectJianyingLibtvConnectionSnapshot(exportNodeId, nodes, edges)
    .frames;
}

/** 优先 LibTV 连线视频；无连线时回退 Pro2 工作区视频列 */
export function collectJianyingFramesForExportNode(
  exportNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  ws?: Pick<StoryWorkspaceIds, "frameColumnId" | "videoColumnId"> | null,
): JianyingFrameExport[] {
  const libtv = collectJianyingFramesFromLibtvVideos(
    exportNodeId,
    nodes,
    edges,
  );
  if (libtv.length) return libtv;
  if (ws) return collectJianyingFramesFromWorkspace(nodes, ws);
  return [];
}
