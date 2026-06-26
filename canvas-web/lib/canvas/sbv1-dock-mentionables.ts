import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import { parseReferencedIds } from "@/components/canvas/mentions/MentionsTextarea";
import {
  isSbv1VideoEngineRefImageNode,
  type Sbv1UpstreamRefLink,
} from "./sbv1-upstream-ref-links";
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
