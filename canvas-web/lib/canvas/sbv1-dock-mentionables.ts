import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import type { Pro2DockUpstreamLink } from "./pro2-dock-upstream-links";
import { buildPro2DockMentionables } from "./pro2-dock-mentionables";
import {
  isSbv1VideoEngineRefImageNode,
  type Sbv1UpstreamRefLink,
} from "./sbv1-upstream-ref-links";
import type { Sbv1UpstreamTextLink } from "./sbv1-upstream-text-links";
import { sbv1TextLinksToDockUpstream } from "./sbv1-upstream-text-links";
import type { Sbv1ImageNodeData } from "./sbv1-workspace-types";
import type { CanvasFlowNode } from "./types";

function previewUrlForLink(
  link: Sbv1UpstreamRefLink,
  nodes?: CanvasFlowNode[],
): string | undefined {
  const source = nodes?.find((n) => n.id === link.sourceNodeId);
  const d = source?.data as Sbv1ImageNodeData | undefined;
  return link.previewUrl ?? d?.ossUrl ?? d?.blobUrl;
}

export function buildSbv1DockMentionables(
  upstreamLinks: Sbv1UpstreamRefLink[],
  nodes?: CanvasFlowNode[],
  prompt?: string,
): MentionableItem[] {
  const byId = new Map<string, MentionableItem>();

  for (const link of upstreamLinks) {
    byId.set(link.id, {
      id: link.id,
      label: link.label,
      kind: "image" as const,
      previewUrl: previewUrlForLink(link, nodes),
    });
  }

  for (const id of parseReferencedIds(prompt ?? "")) {
    if (byId.has(id)) continue;
    const link = upstreamLinks.find((l) => l.id === id);
    if (link) {
      byId.set(id, {
        id: link.id,
        label: link.label,
        kind: "image",
        previewUrl: previewUrlForLink(link, nodes),
      });
      continue;
    }
    const nodeId = id.startsWith("sbv1-ref-") ? id.slice("sbv1-ref-".length) : "";
    const node = nodes?.find(
      (n) => n.id === nodeId && isSbv1VideoEngineRefImageNode(n),
    );
    if (!node) continue;
    const linkIndex =
      upstreamLinks.findIndex((l) => l.id === id) + 1 ||
      upstreamLinks.length + 1;
    const d = node.data as Sbv1ImageNodeData;
    byId.set(id, {
      id,
      label: `图片 ${linkIndex}`,
      kind: "image",
      previewUrl: d.ossUrl ?? d.blobUrl,
    });
  }

  return [...byId.values()];
}

export function sbv1RefLinksToDockUpstream(
  upstreamLinks: Sbv1UpstreamRefLink[],
): Pro2DockUpstreamLink[] {
  return upstreamLinks.map((l) => ({
    id: l.id,
    kind: "image" as const,
    label: l.label,
    previewUrl: l.previewUrl,
    sourceNodeId: l.sourceNodeId,
  }));
}

/** 视频 → 视频 in_motion_video 上游 · 供 Dock @ 与 resolveDockRunPrompt */
export function sbv1MotionVideoLinksToDockUpstream(
  motionVideoLinks: Sbv1UpstreamRefLink[],
): Pro2DockUpstreamLink[] {
  return motionVideoLinks.map((l) => ({
    id: l.id,
    kind: "video" as const,
    label: l.label,
    previewUrl: l.previewUrl,
    sourceNodeId: l.sourceNodeId,
  }));
}

/** 视频 Dock · 合并文本 / 图片 / 上游视频 / 分镜脚本 chip，供 @ 与 resolveDockRunPrompt */
export function buildSbv1VideoEngineDockUpstreamLinks(
  upstreamRefLinks: Sbv1UpstreamRefLink[],
  upstreamTextLinks: Sbv1UpstreamTextLink[],
  extraLinks: Pro2DockUpstreamLink[] = [],
  motionVideoLinks: Sbv1UpstreamRefLink[] = [],
): Pro2DockUpstreamLink[] {
  const seen = new Set<string>();
  const out: Pro2DockUpstreamLink[] = [];
  const push = (link: Pro2DockUpstreamLink) => {
    if (seen.has(link.id)) return;
    seen.add(link.id);
    out.push(link);
  };
  for (const link of extraLinks) push(link);
  for (const link of sbv1TextLinksToDockUpstream(upstreamTextLinks)) push(link);
  for (const link of sbv1MotionVideoLinksToDockUpstream(motionVideoLinks)) {
    push(link);
  }
  for (const link of sbv1RefLinksToDockUpstream(upstreamRefLinks)) push(link);
  return out;
}

/** 视频 Dock @ 列表：文本上游 + 上游视频 + 参考图 + 分镜脚本 chip */
export function buildSbv1VideoEngineDockMentionables(
  upstreamRefLinks: Sbv1UpstreamRefLink[],
  upstreamTextLinks: Sbv1UpstreamTextLink[],
  extraLinks: Pro2DockUpstreamLink[] = [],
  nodes?: CanvasFlowNode[],
  prompt?: string,
  motionVideoLinks: Sbv1UpstreamRefLink[] = [],
): MentionableItem[] {
  const upstream = buildSbv1VideoEngineDockUpstreamLinks(
    upstreamRefLinks,
    upstreamTextLinks,
    extraLinks,
    motionVideoLinks,
  );
  const items = buildPro2DockMentionables(upstream);
  const imageExtras = buildSbv1DockMentionables(upstreamRefLinks, nodes, prompt);
  const seen = new Set(items.map((i) => i.id));
  for (const item of imageExtras) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
