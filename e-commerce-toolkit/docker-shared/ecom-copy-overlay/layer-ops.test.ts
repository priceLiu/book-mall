import { describe, expect, it } from "vitest";

import { defaultCopyOverlay } from "./defaults";
import {
  addOverlayTextLayer,
  overlayHasAnyCopy,
  patchOverlayLayerText,
  primarySlotCopyFromOverlay,
  removeOverlayLayer,
} from "./layer-ops";

describe("layer-ops", () => {
  it("adds a second text block with distinct id", () => {
    const base = defaultCopyOverlay("标题", 750);
    const { overlay, layerId } = addOverlayTextLayer(base);
    expect(overlay.layers).toHaveLength(2);
    expect(layerId).not.toBe("main");
    expect(overlay.layers[1]?.text).toBe("");
  });

  it("patches layer text independently", () => {
    let o = defaultCopyOverlay("A", 750);
    const { overlay, layerId } = addOverlayTextLayer(o);
    o = patchOverlayLayerText(overlay, layerId, "副标题");
    expect(primarySlotCopyFromOverlay(o)).toBe("A");
    expect(o.layers.find((l) => l.id === layerId)?.text).toBe("副标题");
    expect(overlayHasAnyCopy(o)).toBe(true);
  });

  it("removes layer when more than one", () => {
    const { overlay } = addOverlayTextLayer(defaultCopyOverlay("A", 750));
    const id = overlay.layers[1]!.id;
    const next = removeOverlayLayer(overlay, id);
    expect(next.layers).toHaveLength(1);
  });
});
