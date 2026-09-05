import { describe, expect, it } from "vitest";

import { pickStoreToRfPosition } from "@/lib/canvas/canvas-rf-sync-position";

describe("pickStoreToRfPosition", () => {
  it("keeps RF drag position while parentId is unchanged", () => {
    expect(
      pickStoreToRfPosition({
        preserveRfPositions: true,
        rfParentId: "g1",
        storeParentId: "g1",
        rfPosition: { x: 120, y: 80 },
        storePosition: { x: 24, y: 16 },
      }),
    ).toEqual({ x: 120, y: 80 });
  });

  it("uses store absolute position when a child is reparented out of a group", () => {
    expect(
      pickStoreToRfPosition({
        preserveRfPositions: true,
        rfParentId: "g1",
        storeParentId: undefined,
        rfPosition: { x: 120, y: 80 },
        storePosition: { x: 520, y: 280 },
      }),
    ).toEqual({ x: 520, y: 280 });
  });
});
