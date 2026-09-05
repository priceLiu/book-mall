import { describe, expect, it } from "vitest";

import { pointerNearSidePlusMagnetEdge } from "@/lib/canvas/libtv-node-chrome";

describe("pointerNearSidePlusMagnetEdge", () => {
  const rect = {
    top: 100,
    bottom: 400,
    left: 200,
    right: 600,
    height: 300,
  };

  it("ignores pointer below node (typical Dock area)", () => {
    expect(
      pointerNearSidePlusMagnetEdge(500, 520, rect, "right", 112),
    ).toBe(false);
  });

  it("accepts pointer on right edge within middle third", () => {
    expect(
      pointerNearSidePlusMagnetEdge(650, 250, rect, "right", 100),
    ).toBe(true);
  });
});
