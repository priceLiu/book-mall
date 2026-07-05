"use client";

import { collectRefImageUrlsFromGridNode } from "./ref-video-edges";
import { isRefGridNodeType } from "./ref-video-models";
import type { CanvasFlowEdge, CanvasFlowNode } from "./types";
import type { ImageNodeData, ImageEngineNodeData } from "./types";
import { pickRuntimeImagePreviewUrl } from "./task-media-url";
import { storyThemePromptDisplayMd } from "./story-theme-prompt-display";
import type { StoryProStarterNodeData } from "./story-pro-workspace-types";
import type { StoryProScriptHubNodeData } from "./story-pro-workspace-types";

export type Pro2DockUpstreamLink = {
  id: string;
  kind: "outline" | "image" | "text";
  label: string;
  previewUrl?: string;
  previewMd?: string;
  sourceNodeId: string;
};

function imageUrlFromNode(node: CanvasFlowNode): string | undefined {
  if (node.type === "story-pro2-style-asset") {
    const d = node.data as { imageUrl?: string };
    return d.imageUrl?.trim() || undefined;
  }
  if (
    node.type === "image" ||
    node.type === "story-pro2-image" ||
    node.type === "story-pro2-three-view" ||
    node.type === "sbv1-image"
  ) {
    const d = node.data as unknown as ImageNodeData;
    return d.ossUrl ?? d.blobUrl;
  }
  if (node.type === "image-preview") {
    const d = node.data as { url?: string; ossUrl?: string };
    return d.ossUrl ?? d.url;
  }
  if (isRefGridNodeType(node.type ?? "")) {
    return collectRefImageUrlsFromGridNode(node)[0];
  }
  if (
    node.type === "image-engine" ||
    node.type === "three-view-engine" ||
    node.type === "video-engine" ||
    node.type === "sbv1-video-engine"
  ) {
    const d = node.data as unknown as ImageEngineNodeData & {
      ossUrl?: string;
      blobUrl?: string;
      videoUrl?: string;
    };
    return (
      pickRuntimeImagePreviewUrl(d.runtime, d.modelKey) ??
      d.runtime?.ossUrl ??
      d.ossUrl ??
      d.blobUrl ??
      d.videoUrl
    );
  }
  return undefined;
}

function linkFromSource(
  source: CanvasFlowNode,
  targetType: string,
): Pro2DockUpstreamLink | null {
  if (source.type === "story-pro2-starter") {
    const d = source.data as unknown as StoryProStarterNodeData;
    const outline = d.generatedOutlineMd?.trim();
    const uploaded = d.uploadedScriptMd?.trim();
    if (uploaded) {
      return {
        id: `up-script-${source.id}`,
        kind: "outline",
        label: d.uploadedScriptMeta?.fileName?.trim() || "已上传剧本",
        previewMd: uploaded.slice(0, 800),
        sourceNodeId: source.id,
      };
    }
    if (outline) {
      return {
        id: `up-outline-${source.id}`,
        kind: "outline",
        label: "故事大纲",
        previewMd: storyThemePromptDisplayMd(outline),
        sourceNodeId: source.id,
      };
    }
    const theme = d.themeInput?.trim();
    if (theme) {
      return {
        id: `up-text-${source.id}`,
        kind: "text",
        label: "文本",
        previewMd: theme,
        sourceNodeId: source.id,
      };
    }
    return null;
  }

  if (targetType === "story-pro2-script-hub") {
    const d = source.data as unknown as StoryProScriptHubNodeData;
    const outline = d.outlineMd?.trim();
    if (outline) {
      return {
        id: `up-outline-${source.id}`,
        kind: "outline",
        label: "故事大纲",
        previewMd: storyThemePromptDisplayMd(outline),
        sourceNodeId: source.id,
      };
    }
  }

  if (source.type === "story-pro2-style-asset") {
    const d = source.data as { styleName?: string; label?: string; stylePrompt?: string };
    const name = d.styleName?.trim() || d.label?.trim() || "风格";
    return {
      id: `up-style-${source.id}`,
      kind: "image",
      label: name,
      previewUrl: imageUrlFromNode(source),
      previewMd: d.stylePrompt?.trim(),
      sourceNodeId: source.id,
    };
  }

  const url = imageUrlFromNode(source);
  if (url) {
    const label =
      (source.data as { label?: string }).label ??
      (source.type === "image" ? "图片" : "参考图");
    return {
      id: `up-img-${source.id}`,
      kind: "image",
      label,
      previewUrl: url,
      sourceNodeId: source.id,
    };
  }

  return null;
}

function targetInputHandle(nodeType: string): string {
  if (
    nodeType === "story-pro2-image" ||
    nodeType === "story-pro2-three-view" ||
    nodeType === "sbv1-image"
  ) {
    return "in_image";
  }
  return "in_text";
}

const IMAGE_UPSTREAM_SOURCE_TYPES = new Set([
  "image",
  "image-preview",
  "story-pro2-image",
  "story-pro2-three-view",
  "story-pro2-style-asset",
  "sbv1-image",
  "image-engine",
  "three-view-engine",
]);

function edgeMatchesDockInput(
  edge: CanvasFlowEdge,
  nodeId: string,
  nodeType: string,
  nodes: CanvasFlowNode[],
): boolean {
  if (edge.target !== nodeId) return false;
  const inHandle = targetInputHandle(nodeType);
  if (!edge.targetHandle || edge.targetHandle === inHandle) return true;
  // 历史连线可能误用 in_text / default，仍应展示图片上游缩略图
  if (inHandle === "in_image") {
    const source = nodes.find((n) => n.id === edge.source);
    if (source?.type && IMAGE_UPSTREAM_SOURCE_TYPES.has(source.type)) {
      return (
        edge.targetHandle === "in_text" || edge.targetHandle === "default"
      );
    }
  }
  return false;
}

/** 解析节点左侧入边 · 供输入坞展示链接态 chip */
export function resolvePro2DockUpstreamLinks(
  nodeId: string,
  nodeType: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2DockUpstreamLink[] {
  const incoming = edges.filter((e) =>
    edgeMatchesDockInput(e, nodeId, nodeType, nodes),
  );
  const out: Pro2DockUpstreamLink[] = [];
  const seen = new Set<string>();

  for (const e of incoming) {
    const source = nodes.find((n) => n.id === e.source);
    if (!source) continue;
    const link = linkFromSource(source, nodeType);
    if (!link || seen.has(link.id)) continue;
    seen.add(link.id);
    out.push(link);
  }

  // 脚本节点：大纲也可能仅写在 data（自动连线），无重复则补一条
  if (nodeType === "story-pro2-script-hub") {
    const hub = nodes.find((n) => n.id === nodeId);
    const outline = (
      hub?.data as StoryProScriptHubNodeData | undefined
    )?.outlineMd?.trim();
    if (outline && !out.some((l) => l.kind === "outline")) {
      out.unshift({
        id: `up-outline-data-${nodeId}`,
        kind: "outline",
        label: "故事大纲",
        previewMd: storyThemePromptDisplayMd(outline),
        sourceNodeId: nodeId,
      });
    }
  }

  return out;
}

/** Dock 顶栏风格按钮 · 已连风格素材节点 */
export function resolvePro2DockStyleFromUpstream(
  links: Pro2DockUpstreamLink[],
): { name: string } | null {
  const style = links.find((l) => l.id.startsWith("up-style-"));
  if (!style) return null;
  return { name: style.label };
}

export type Pro2DockStyleRef = {
  name?: string;
  imageUrl?: string;
};

function hasPro2DockStyleSlot(links: Pro2DockUpstreamLink[]): boolean {
  return links.some((l) => l.id.startsWith("up-style-"));
}

/**
 * 将风格库选中（dockStyleRef）合并进缩略图槽位行；
 * 已连风格素材节点时不重复插入。
 */
export function enrichPro2DockUpstreamLinks(
  links: Pro2DockUpstreamLink[],
  dockStyleRef?: Pro2DockStyleRef | null,
  anchorNodeId?: string,
): Pro2DockUpstreamLink[] {
  if (hasPro2DockStyleSlot(links)) return links;
  const imageUrl = dockStyleRef?.imageUrl?.trim();
  if (!imageUrl) return links;
  return [
    ...links,
    {
      id: "up-style-dock",
      kind: "image",
      label: dockStyleRef?.name?.trim() || "风格",
      previewUrl: imageUrl,
      sourceNodeId: anchorNodeId ?? "",
    },
  ];
}

/** 缩略图 chip 仅展示真实入边（不含 dockStyleRef 虚拟槽） */
export function pro2DockUpstreamLinksForChips(
  links: Pro2DockUpstreamLink[],
): Pro2DockUpstreamLink[] {
  return links.filter(
    (l) =>
      l.sourceNodeId &&
      !l.id.startsWith("up-style-dock") &&
      l.id !== "up-style-dock",
  );
}

/** 该上游 chip 是否来自画布连线（可显示角标 / 断开） */
export function isPro2DockUpstreamEdgeLink(
  link: Pro2DockUpstreamLink,
  anchorNodeId: string,
): boolean {
  return Boolean(
    link.sourceNodeId &&
      link.sourceNodeId !== anchorNodeId &&
      !link.id.startsWith("up-style-dock"),
  );
}
/** 风格已占槽位时隐藏独立「风格」按钮，避免第二行重复展示 */
export function pro2DockStyleShownAsChip(
  links: Pro2DockUpstreamLink[],
  dockStyleRef?: Pro2DockStyleRef | null,
): boolean {
  return hasPro2DockStyleSlot(enrichPro2DockUpstreamLinks(links, dockStyleRef));
}
