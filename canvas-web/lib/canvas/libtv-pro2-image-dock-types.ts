/** Pro2 · 使用 LibtvImageInputDock（Pro2InputDockShell）的节点 type */
export const LIBTV_PRO2_IMAGE_DOCK_NODE_TYPES = [
  "story-pro2-image",
  "story-pro2-prop",
  "story-pro2-mood",
  "story-pro2-audio",
] as const;

export type LibtvPro2ImageDockNodeType =
  (typeof LIBTV_PRO2_IMAGE_DOCK_NODE_TYPES)[number];

export function isLibtvPro2ImageDockNodeType(
  type: string | undefined,
): type is LibtvPro2ImageDockNodeType {
  return (
    type != null &&
    (LIBTV_PRO2_IMAGE_DOCK_NODE_TYPES as readonly string[]).includes(type)
  );
}
