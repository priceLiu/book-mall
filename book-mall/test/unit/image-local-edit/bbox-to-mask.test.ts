import { describe, expect, it } from "vitest";

import {
  bboxToMaskPngDataUrl,
  normalizedBboxesToMaskPngDataUrl,
} from "@/lib/image-local-edit/bbox-to-mask";

describe("bboxToMaskPngDataUrl", () => {
  it("returns a png data URL", async () => {
    const url = await bboxToMaskPngDataUrl([10, 20, 40, 80], 100, 100);
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(40);
  });

  it("rejects invalid canvas size", async () => {
    await expect(bboxToMaskPngDataUrl([0, 0, 10, 10], 0, 10)).rejects.toThrow(
      "底图尺寸无效",
    );
  });
});

describe("normalizedBboxesToMaskPngDataUrl", () => {
  it("unions multiple normalized boxes into one mask", async () => {
    const url = await normalizedBboxesToMaskPngDataUrl(
      [
        [0, 0, 200, 200],
        [500, 500, 800, 800],
      ],
      64,
      64,
    );
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    expect(url.length).toBeGreaterThan(40);
  });

  it("rejects empty bbox list", async () => {
    await expect(normalizedBboxesToMaskPngDataUrl([], 64, 64)).rejects.toThrow(
      "缺少擦除区域",
    );
  });
});
