import { describe, expect, it } from "vitest";

import {
  resolveSeedreamLayerTargetSize,
  SEEDREAM_LAYER_MAX_PIXELS,
  SEEDREAM_LAYER_MIN_PIXELS,
} from "@/lib/ecom/ecom-image-layer-source-normalize";

describe("resolveSeedreamLayerTargetSize", () => {
  it("upscales tiny images to meet min pixels", () => {
    const { width, height } = resolveSeedreamLayerTargetSize(400, 400);
    expect(width * height).toBeGreaterThanOrEqual(SEEDREAM_LAYER_MIN_PIXELS);
  });

  it("downscales huge images", () => {
    const { width, height } = resolveSeedreamLayerTargetSize(8000, 8000);
    expect(width * height).toBeLessThanOrEqual(SEEDREAM_LAYER_MAX_PIXELS);
  });

  it("raises the short side of a wide sticker to at least 512", () => {
    const { width, height } = resolveSeedreamLayerTargetSize(355, 93);
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(512);
    expect(width / height).toBeGreaterThan(3);
    expect(width * height).toBeLessThanOrEqual(SEEDREAM_LAYER_MAX_PIXELS);
  });

  it("rejects extreme aspect ratio", () => {
    expect(() => resolveSeedreamLayerTargetSize(1000, 10)).toThrow(/宽高比/);
  });
});
