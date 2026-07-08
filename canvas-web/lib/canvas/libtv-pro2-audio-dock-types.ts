/** Pro2 · 使用 LibtvAudioInputDock 的节点 type */
export const LIBTV_PRO2_AUDIO_DOCK_NODE_TYPES = ["story-pro2-audio"] as const;

export type LibtvPro2AudioDockNodeType =
  (typeof LIBTV_PRO2_AUDIO_DOCK_NODE_TYPES)[number];

export function isLibtvPro2AudioDockNodeType(
  type: string | undefined,
): type is LibtvPro2AudioDockNodeType {
  return (
    type != null &&
    (LIBTV_PRO2_AUDIO_DOCK_NODE_TYPES as readonly string[]).includes(type)
  );
}

export function isLibtvFreestandingAudioNode(
  node: Pick<{ type?: string }, "type"> | undefined,
): boolean {
  return node?.type === "story-pro2-audio";
}
