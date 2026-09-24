import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/image-layer-bbox-to-mask", () => ({
  bboxToMaskDataUrl: () => "data:image/png;base64,mask-from-bbox",
}));

import {
  resolveEraseSelectionPayload,
  resolveLocalEditSelectionPayload,
} from "@/lib/image-layer-local-edit-payload";

describe("resolveLocalEditSelectionPayload", () => {
  it("wan2.7 only forwards bbox, never a mask", () => {
    expect(
      resolveLocalEditSelectionPayload({
        model: "wan2.7-image-pro",
        mask: "data:image/png;base64,xxx",
        bbox: [1, 2, 3, 4],
      }),
    ).toEqual({ bbox: [1, 2, 3, 4] });
  });

  it("wanx / qwen use painted mask as-is", () => {
    expect(
      resolveLocalEditSelectionPayload({
        model: "qwen-image-edit",
        mask: "data:image/png;base64,brush",
        bbox: [1, 2, 3, 4],
        natural: { w: 100, h: 100 },
      }),
    ).toEqual({ maskImageDataUrl: "data:image/png;base64,brush" });
  });

  it("wanx / qwen convert a single edit bbox to mask", () => {
    expect(
      resolveLocalEditSelectionPayload({
        model: "wanx-x-painting",
        bbox: [10, 20, 40, 80],
        natural: { w: 200, h: 200 },
      }),
    ).toEqual({ maskImageDataUrl: "data:image/png;base64,mask-from-bbox" });
  });
});

describe("resolveEraseSelectionPayload", () => {
  it("uses painted mask as-is for image-erase-completion", () => {
    expect(
      resolveEraseSelectionPayload({
        mask: "data:image/png;base64,brush",
        bbox: [1, 2, 3, 4],
        natural: { w: 100, h: 100 },
      }),
    ).toEqual({ maskDataUrl: "data:image/png;base64,brush" });
  });

  it("converts a single bbox to mask (never bbox-only)", () => {
    expect(
      resolveEraseSelectionPayload({
        bbox: [10, 20, 40, 80],
        natural: { w: 200, h: 200 },
      }),
    ).toEqual({ maskDataUrl: "data:image/png;base64,mask-from-bbox" });
  });
});
