import type { CanvasGraph } from "./types";

export type TemplateDiagramNode = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
};

export type TemplateDiagramEdge = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type TemplateWorkflowDiagramLayout = {
  nodes: TemplateDiagramNode[];
  edges: TemplateDiagramEdge[];
  viewBox: { x: number; y: number; w: number; h: number };
};

const DEFAULT_W = 260;
const DEFAULT_H = 140;
const GROUP_W = 420;
const GROUP_H = 300;

function readNodeSize(node: {
  width?: number;
  height?: number;
  style?: unknown;
  type?: string;
}): { w: number; h: number } {
  const style =
    node.style && typeof node.style === "object"
      ? (node.style as { width?: number; height?: number })
      : undefined;
  const w = node.width ?? style?.width ?? (node.type === "group" ? GROUP_W : DEFAULT_W);
  const h = node.height ?? style?.height ?? (node.type === "group" ? GROUP_H : DEFAULT_H);
  return { w: Math.max(24, w), h: Math.max(20, h) };
}

function nodeCenter(n: TemplateDiagramNode): { x: number; y: number } {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 };
}

export function buildTemplateWorkflowDiagramLayout(
  graph: CanvasGraph | null | undefined,
): TemplateWorkflowDiagramLayout | null {
  if (!graph?.nodes?.length) return null;

  const nodes: TemplateDiagramNode[] = graph.nodes.map((n) => {
    const { w, h } = readNodeSize(n);
    return {
      id: n.id,
      x: n.position?.x ?? 0,
      y: n.position?.y ?? 0,
      w,
      h,
      type: n.type ?? "default",
    };
  });

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const edges: TemplateDiagramEdge[] = (graph.edges ?? [])
    .map((e) => {
      const src = byId.get(e.source);
      const tgt = byId.get(e.target);
      if (!src || !tgt) return null;
      const c1 = nodeCenter(src);
      const c2 = nodeCenter(tgt);
      return { id: e.id, x1: c1.x, y1: c1.y, x2: c2.x, y2: c2.y };
    })
    .filter(Boolean) as TemplateDiagramEdge[];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.w);
    maxY = Math.max(maxY, n.y + n.h);
  }
  if (!Number.isFinite(minX)) return null;

  const pad = 48;
  return {
    nodes,
    edges,
    viewBox: {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(maxX - minX + pad * 2, 120),
      h: Math.max(maxY - minY + pad * 2, 80),
    },
  };
}

export function templateDiagramNodeFill(type: string): string {
  if (type === "group") return "rgba(167,139,250,0.35)";
  if (type.includes("image") || type.includes("three-view")) return "rgba(251,146,60,0.35)";
  if (type.includes("video")) return "rgba(34,211,238,0.32)";
  if (
    type.includes("text") ||
    type.includes("script") ||
    type.includes("starter") ||
    type.includes("hub")
  )
    return "rgba(96,165,250,0.32)";
  if (type.includes("engine") || type.includes("ai")) return "rgba(129,140,248,0.3)";
  return "rgba(255,255,255,0.14)";
}
