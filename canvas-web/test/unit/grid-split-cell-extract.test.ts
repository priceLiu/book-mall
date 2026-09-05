import { describe, expect, it } from "vitest";
import { gridSplitCellExtractRect } from "@/lib/canvas/grid-split-cell-extract";

describe("gridSplitCellExtractRect", () => {
  it("covers full width for 6 columns without gap", () => {
    const w = 1000;
    const h = 600;
    let right = 0;
    for (let col = 0; col < 6; col++) {
      const r = gridSplitCellExtractRect(w, h, col, 0, 6, 3);
      expect(r.left).toBeGreaterThanOrEqual(right - 1);
      right = r.left + r.width;
    }
    expect(right).toBeGreaterThanOrEqual(w - 2);
  });

  it("returns positive dimensions for edge cell", () => {
    const r = gridSplitCellExtractRect(1001, 601, 5, 2, 6, 3);
    expect(r.width).toBeGreaterThan(0);
    expect(r.height).toBeGreaterThan(0);
    expect(r.left + r.width).toBeLessThanOrEqual(1001);
    expect(r.top + r.height).toBeLessThanOrEqual(601);
  });
});
