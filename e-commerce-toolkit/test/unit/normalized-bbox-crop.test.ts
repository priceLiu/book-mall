import { describe, expect, it } from "vitest";

import { normalizedBboxToPixelRect } from "@/lib/normalized-bbox-crop";

describe("normalizedBboxToPixelRect", () => {
  it("uses the source image pixel size, not the 0–999 box as a square", () => {
    const landscape = normalizedBboxToPixelRect([0, 0, 500, 999], 2000, 1000);
    expect(landscape.w / landscape.h).toBeCloseTo(1, 1);

    const portrait = normalizedBboxToPixelRect([0, 0, 999, 500], 1000, 2000);
    expect(portrait.w / portrait.h).toBeCloseTo(1, 1);
  });

  it("converts official 0–999 coords with /1000", () => {
    const rect = normalizedBboxToPixelRect([250, 100, 750, 900], 1000, 1000);
    expect(rect).toEqual({ x: 250, y: 100, w: 500, h: 800 });
  });
});
