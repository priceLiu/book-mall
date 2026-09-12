import { describe, expect, it } from "vitest";

import {
  assertLocalEditSelection,
  getLocalEditSelectionMode,
  normalizeBbox,
} from "@/lib/image-local-edit/model-capabilities";

describe("image-local-edit model-capabilities", () => {
  it("routes qwen to mask-optional", () => {
    expect(getLocalEditSelectionMode("qwen-image-edit")).toBe("mask-optional");
  });

  it("routes wanx to required mask", () => {
    expect(getLocalEditSelectionMode("wanx-x-painting")).toBe("mask");
    expect(() => assertLocalEditSelection("wanx-x-painting")).toThrow(/蒙版/);
  });

  it("routes wan2.7 to bbox", () => {
    expect(getLocalEditSelectionMode("wan2.7-image-pro")).toBe("bbox");
    expect(() => assertLocalEditSelection("wan2.7-image-pro")).toThrow(/框选/);
  });

  it("normalizes bbox coordinates", () => {
    expect(normalizeBbox([100, 50, 10, 20])).toEqual([10, 20, 100, 50]);
  });
});
