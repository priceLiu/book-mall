import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { resolveStoryProStarterScriptInput } from "./story-pro-starter-text";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Sbv1UpstreamTextLink = {
  id: string;
  index: number;
  label: string;
  preview: string;
  sourceNodeId: string;
  edgeId: string;
};

function textPreviewFromStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string {
  const d = nodes.find((n) => n.id === nodeId)?.data as
    | {
        themeInput?: string;
        generatedOutlineMd?: string;
        dockInput?: string;
      }
    | undefined;
  const script = resolveStoryProStarterScriptInput(nodes, edges, nodeId);
  const raw =
    script?.trim() ||
    d?.dockInput?.trim() ||
    d?.generatedOutlineMd?.trim() ||
    d?.themeInput?.trim() ||
    "";
  if (!raw) return "文本节点";
  return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
}

/** sbv1-video-engine · in_text 上游文本节点 */
export function resolveSbv1UpstreamTextLinks(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Sbv1UpstreamTextLink[] {
  const incoming = edges.filter(
    (e) =>
      e.target === engineNodeId &&
      (e.targetHandle === "in_text" || e.targetHandle === "in_prompt"),
  );
  const links: Sbv1UpstreamTextLink[] = [];
  let index = 0;
  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source || source.type !== "story-pro2-starter") continue;
    index += 1;
    links.push({
      id: `sbv1-text-${source.id}`,
      index,
      label: `文本 ${index}`,
      preview: textPreviewFromStarter(nodes, edges, source.id),
      sourceNodeId: source.id,
      edgeId: edge.id,
    });
  }
  return links;
}

/** 视频 Dock 顶栏 · 文本上游 chip（对齐 Pro2DockUpstreamChips） */
export function sbv1TextLinksToDockUpstream(
  links: Sbv1UpstreamTextLink[],
): Pro2DockUpstreamLink[] {
  return links.map((l) => ({
    id: l.id,
    kind: "text" as const,
    label: l.preview,
    previewMd: l.preview,
    sourceNodeId: l.sourceNodeId,
  }));
}
