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
  if (nodeType === "story-pro2-image" || nodeType === "sbv1-image") {
    return "in_image";
  }
  return "in_text";
}

/** 解析节点左侧入边 · 供输入坞展示链接态 chip */
export function resolvePro2DockUpstreamLinks(
  nodeId: string,
  nodeType: string,
  nodes: CanvasFlowNode[],
  edges: CanvasFlowEdge[],
): Pro2DockUpstreamLink[] {
  const inHandle = targetInputHandle(nodeType);
  const incoming = edges.filter(
    (e) =>
      e.target === nodeId &&
      (!e.targetHandle || e.targetHandle === inHandle),
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
