import { describe, expect, it } from "vitest";

import {
  computeBatchConnectMagnetScreenOffset,
  computeSidePlusMagnetScreenOffset,
  pointerNearBatchConnectMagnetEdge,
  pointerNearSidePlusMagnetEdge,
  sidePlusAnchorFromClientRect,
} from "@/lib/canvas/libtv-node-chrome";

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

describe("computeSidePlusMagnetScreenOffset", () => {
  const rect = {
    top: 100,
    bottom: 400,
    left: 200,
    right: 500,
    height: 300,
  };

  it("offsets toward pointer outside right edge", () => {
    const offset = computeSidePlusMagnetScreenOffset(520, 250, rect, "right");
    expect(offset.y).toBe(0);
    expect(offset.x).toBe(-20);
  });
});

describe("batch connect magnet", () => {
  const rect = {
    top: 100,
    bottom: 700,
    left: 200,
    right: 500,
    height: 600,
  };

  it("activates along full selection height (not middle-third only)", () => {
    expect(
      pointerNearBatchConnectMagnetEdge(520, 650, rect, "right", 100),
    ).toBe(true);
  });

  it("follows pointer Y along tall selection box", () => {
    const offset = computeBatchConnectMagnetScreenOffset(520, 650, rect, "right");
    expect(offset.y).toBeGreaterThan(100);
  });
});

describe("sidePlusAnchorFromClientRect", () => {
  it("places batch + outside right edge with magnet offset", () => {
    const rect = {
      top: 100,
      bottom: 400,
      left: 200,
      right: 500,
      height: 300,
    };
    const anchor = sidePlusAnchorFromClientRect(rect, "right", { x: 12, y: 20 });
    expect(anchor.left).toBe(492);
    expect(anchor.top).toBe(270);
  });
});
