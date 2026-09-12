"use client";

export type MagicEditFrameScreenAnchor = {
  centerX: number;
  bottomY: number;
  width: number;
};

type FrameAnchorEntry = {
  getFrameElement: () => HTMLElement | null;
};

const anchors = new Map<string, FrameAnchorEntry>();

export function registerMagicEditFrameAnchor(
  nodeId: string,
  getFrameElement: () => HTMLElement | null,
): () => void {
  const entry: FrameAnchorEntry = { getFrameElement };
  anchors.set(nodeId, entry);
  return () => {
    if (anchors.get(nodeId) === entry) anchors.delete(nodeId);
  };
}

export function getMagicEditFrameScreenAnchor(
  nodeId: string,
): MagicEditFrameScreenAnchor | null {
  const el = anchors.get(nodeId)?.getFrameElement();
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return {
    centerX: r.left + r.width / 2,
    bottomY: r.bottom,
    width: r.width,
  };
}
