import { describe, expect, it } from "vitest";

import {
  canvasImageEditRequiresRefs,
  isCanvasImageEditModel,
} from "@/lib/canvas/canvas-image-edit-models";

describe("canvas-image-edit-models", () => {
  it("recognizes qwen and wan2.7-image-pro edit models", () => {
    expect(isCanvasImageEditModel("qwen-image-edit")).toBe(true);
    expect(isCanvasImageEditModel("qwen-image-edit-max")).toBe(true);
    expect(isCanvasImageEditModel("wan2.7-image-pro")).toBe(true);
    expect(isCanvasImageEditModel("wan2.7-image")).toBe(false);
  });

  it("requires refs for qwen edit always; wan2.7-image-pro only in img2img", () => {
    expect(canvasImageEditRequiresRefs("qwen-image-edit")).toBe(true);
    expect(canvasImageEditRequiresRefs("wan2.7-image-pro")).toBe(false);
    expect(
      canvasImageEditRequiresRefs("wan2.7-image-pro", { imageMode: "img2img" }),
    ).toBe(true);
    expect(canvasImageEditRequiresRefs("qwen-image-3.0-pro")).toBe(false);
  });
});
