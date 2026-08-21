import { describe, expect, it } from "vitest";

import { getGatewayModelTypeLabels } from "@/lib/canvas/gateway-model-type-labels";
import { SBV1_IMAGE_MODEL_KEYS } from "@/lib/canvas/sbv1-image-models";

describe("getGatewayModelTypeLabels · IMAGE", () => {
  it("labels dedicated image-edit models as 图片编辑", () => {
    expect(
      getGatewayModelTypeLabels({
        modelKey: "qwen-image-edit",
        role: "IMAGE",
      }),
    ).toEqual(["图片编辑"]);
    expect(
      getGatewayModelTypeLabels({
        modelKey: "qwen-image-edit-max",
        role: "IMAGE",
      }),
    ).toEqual(["图片编辑"]);
    expect(
      getGatewayModelTypeLabels({
        modelKey: "google/nano-banana-edit",
        role: "IMAGE",
      }),
    ).toEqual(["图片编辑"]);
  });

  it("keeps Wan 2.6 as 文生图 · 图生图", () => {
    expect(
      getGatewayModelTypeLabels({
        modelKey: "wan2.6-image",
        role: "IMAGE",
      }),
    ).toEqual(["文生图", "图生图"]);
  });
});

describe("SBV1_IMAGE_MODEL_KEYS", () => {
  it("includes image-edit models for the image node picker", () => {
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("qwen-image-edit");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("qwen-image-edit-max");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("wan2.6-image");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("google/nano-banana-edit");
  });
});
