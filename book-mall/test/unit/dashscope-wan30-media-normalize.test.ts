import { describe, expect, it } from "vitest";

import {
  resolveWan30ReferenceImageDimensions,
  WAN30_REF_IMAGE_MAX_SIDE,
  WAN30_REF_IMAGE_MIN_SIDE,
} from "@/lib/canvas/dashscope-wan30-media-normalize";

describe("resolveWan30ReferenceImageDimensions", () => {
  it("upscales when shortest side below 240", () => {
    const { width, height } = resolveWan30ReferenceImageDimensions(100, 200);
    expect(Math.min(width, height)).toBeGreaterThanOrEqual(WAN30_REF_IMAGE_MIN_SIDE);
  });

  it("downscales when longest side above 8000", () => {
    const { width, height } = resolveWan30ReferenceImageDimensions(9000, 4500);
    expect(Math.max(width, height)).toBeLessThanOrEqual(WAN30_REF_IMAGE_MAX_SIDE);
  });

  it("keeps in-range dimensions", () => {
    const { width, height } = resolveWan30ReferenceImageDimensions(720, 1280);
    expect(width).toBe(720);
    expect(height).toBe(1280);
  });
});
