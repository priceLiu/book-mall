import { describe, expect, it } from "vitest";

import { computeLayerDrawSize } from "@/lib/image-layer-placement";

describe("computeLayerDrawSize", () => {
  it("scales by canvas width preserving aspect ratio", () => {
    expect(computeLayerDrawSize(1000, 1500, 800)).toEqual({
      width: 800,
      height: 1200,
    });
  });

  it("handles square images", () => {
    expect(computeLayerDrawSize(1024, 1024, 512)).toEqual({
      width: 512,
      height: 512,
    });
  });
});
