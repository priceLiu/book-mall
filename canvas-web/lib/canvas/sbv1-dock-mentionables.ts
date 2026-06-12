import type { MentionableItem } from "@/components/canvas/mentions/MentionsTextarea";
import type { Sbv1UpstreamRefLink } from "./sbv1-upstream-ref-links";

export function buildSbv1DockMentionables(
  upstreamLinks: Sbv1UpstreamRefLink[],
): MentionableItem[] {
  return upstreamLinks.map((link) => ({
    id: link.id,
    label: link.label,
    kind: "image" as const,
    previewUrl: link.previewUrl,
  }));
}
