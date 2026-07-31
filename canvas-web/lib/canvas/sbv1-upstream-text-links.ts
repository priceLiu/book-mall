import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { resolveStoryProStarterScriptInput } from "./story-pro-starter-text";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";

export type Sbv1UpstreamTextLink = {
  id: string;
  index: number;
  label: string;
  preview: string;
  /** 展开 @ 引用 / 提交生成时使用（完整正文，非 chip 截断） */
  fullText: string;
  sourceNodeId: string;
  edgeId: string;
};

function textFullFromStarter(
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
  return (
    script?.trim() ||
    d?.dockInput?.trim() ||
    d?.generatedOutlineMd?.trim() ||
    d?.themeInput?.trim() ||
    ""
  );
}

function textPreviewFromStarter(
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
  nodeId: string,
): string {
  const raw = textFullFromStarter(nodes, edges, nodeId);
  if (!raw) return "文本节点";
  return raw.length > 48 ? `${raw.slice(0, 48)}…` : raw;
}

function textFullFromScriptHub(node: CanvasFlowNode | undefined): string {
  const d = node?.data as
    | {
        outlineMd?: string;
        storyboardMd?: string;
        characterMd?: string;
      }
    | undefined;
  return (
    d?.storyboardMd?.trim() ||
    d?.outlineMd?.trim() ||
    d?.characterMd?.trim() ||
    ""
  );
}

/** sbv1-video-engine · in_text 上游文本节点（兼容历史误标 in_ref 的文本连线） */
export function resolveSbv1UpstreamTextLinks(
  engineNodeId: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Sbv1UpstreamTextLink[] {
  const incoming = edges.filter((e) => {
    if (e.target !== engineNodeId) return false;
    if (e.targetHandle === "in_text" || e.targetHandle === "in_prompt") {
      return true;
    }
    const source = nodes.find((n) => n.id === e.source);
    const isTextSource =
      source?.type === "story-pro2-starter" ||
      source?.type === "story-pro2-script-hub";
    if (!isTextSource) return false;
    return (
      e.targetHandle === "in_ref" ||
      e.targetHandle === "default" ||
      !e.targetHandle
    );
  });
  const links: Sbv1UpstreamTextLink[] = [];
  let index = 0;
  for (const edge of incoming) {
    const source = nodes.find((n) => n.id === edge.source);
    if (!source) continue;
    const isStarter = source.type === "story-pro2-starter";
    const isHub = source.type === "story-pro2-script-hub";
    if (!isStarter && !isHub) continue;
    index += 1;
    const fullText = isStarter
      ? textFullFromStarter(nodes, edges, source.id)
      : textFullFromScriptHub(source);
    links.push({
      id: `sbv1-text-${source.id}`,
      index,
      label: `文本 ${index}`,
      preview: isStarter
        ? textPreviewFromStarter(nodes, edges, source.id)
        : fullText
          ? fullText.length > 48
            ? `${fullText.slice(0, 48)}…`
            : fullText
          : "故事脚本生成",
      fullText,
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
    label: l.label,
    previewMd: l.fullText.trim() || l.preview,
    sourceNodeId: l.sourceNodeId,
  }));
}
