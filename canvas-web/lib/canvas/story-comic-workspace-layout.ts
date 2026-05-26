import type { CanvasFlowEdge, CanvasFlowNode, CanvasNodeType } from "./types";
import { NODE_DEFAULT_SIZE } from "./types";
import { nodeMeasuredSize, sortNodesForReactFlow } from "./normalize-graph-nodes";
import { applyStoryColumnHeights } from "./story-column-layout";
import { hasStoryComicPipeline } from "./story-comic-layout";
import { storyComicStarterNodeHeight } from "./story-node-chrome";

const COL_H_GAP = 120;

/** 重排横向步进：取 style/width、RF measured、类型默认宽度的最大值，避免列视觉重叠 */
function nodeReflowWidth(n: CanvasFlowNode): number {
  const { w } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.width ?? 0;
  const measured = (n as { measured?: { width?: number } }).measured?.width;
  return Math.max(w, def, measured ?? 0);
}

/** 节点可视高度（与 nodeReflowWidth 对称） */
function nodeReflowHeight(n: CanvasFlowNode): number {
  const { h } = nodeMeasuredSize(n);
  const t = (n.type ?? "text") as CanvasNodeType;
  const def = NODE_DEFAULT_SIZE[t]?.height ?? 0;
  const measured = (n as { measured?: { height?: number } }).measured?.height;
  return Math.max(h, def, measured ?? 0);
}

function applyNodeHeight(n: CanvasFlowNode, height: number): CanvasFlowNode {
  const width = nodeReflowWidth(n);
  return {
    ...n,
    width,
    height,
    style: { ...(n.style ?? {}), width, height },
  } as CanvasFlowNode;
}

/** 故事主题 / 故事大纲同高（按最长模板推算，底边对齐） */
function applyStoryControlRowHeights(nodes: CanvasFlowNode[]): CanvasFlowNode[] {
  const rowH = storyComicStarterNodeHeight();
  return nodes.map((n) => {
    if (n.type === "story-comic-starter" || n.type === "story-script-hub") {
      return applyNodeHeight(n, rowH);
    }
    return n;
  });
}

const ROW_Y = 120;

const WORKSPACE_COLUMN_TYPES: CanvasNodeType[] = [
  "story-comic-starter",
  "story-script-hub",
  "story-character-column",
  "story-frame-column",
  "story-video-column",
];

/** 漫剧工作流：启动 | 文案中枢 | 角色列 | 分镜列 | 视频列 | 导出 */
export function reflowStoryComicWorkspace(
  nodes: CanvasFlowNode[],
  _edges: CanvasFlowEdge[] = [],
): CanvasFlowNode[] {
  if (!hasStoryComicPipeline(nodes)) return nodes;

  let next = applyStoryColumnHeights(nodes);
  next = applyStoryControlRowHeights(next);

  const starter = next.find((n) => n.type === "story-comic-starter");
  const exportNode = next.find((n) => n.type === "jianying-export");
  const origin = starter?.position ?? { x: 80, y: ROW_Y };
  const rowBottom =
    origin.y + (starter ? nodeReflowHeight(starter) : NODE_DEFAULT_SIZE["story-comic-starter"].height);

  const placeBottomAligned = (node: CanvasFlowNode, x: number) => {
    const h = nodeReflowHeight(node);
    return {
      ...node,
      position: { x, y: rowBottom - h },
    } as CanvasFlowNode;
  };

  let x = origin.x;

  for (const type of WORKSPACE_COLUMN_TYPES) {
    const node = next.find((n) => n.type === type);
    if (!node) continue;
    const id = node.id;
    const placed = placeBottomAligned(node, x);
    next = next.map((n) => (n.id === id ? placed : n));
    x += nodeReflowWidth(node) + COL_H_GAP;
  }

  if (exportNode) {
    const ref =
      next.find((n) => n.type === "story-video-column") ??
      next.find((n) => n.type === "story-frame-column") ??
      next.find((n) => n.type === "story-character-column") ??
      next.find((n) => n.type === "story-script-hub") ??
      starter;
    const refPos = ref?.position ?? { x: origin.x, y: origin.y };
    const refW = ref ? nodeReflowWidth(ref) : 400;
    const placed = placeBottomAligned(exportNode, refPos.x + refW + COL_H_GAP);
    next = next.map((n) => (n.id === exportNode.id ? placed : n));
  }

  return sortNodesForReactFlow(next);
}
