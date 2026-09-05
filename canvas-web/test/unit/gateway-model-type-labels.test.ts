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

  it("labels wan2.7-image-pro as 图片编辑", () => {
    expect(
      getGatewayModelTypeLabels({
        modelKey: "wan2.7-image-pro",
        role: "IMAGE",
      }),
    ).toEqual(["图片编辑"]);
  });
});

describe("getGatewayModelTypeLabels · LLM", () => {
  it("labels qwen3.8-max as All-in-One 文本/图片/视频理解", () => {
    expect(
      getGatewayModelTypeLabels({
        modelKey: "qwen3.8-max",
        role: "LLM",
      }),
    ).toEqual(["文本模型", "图片反推", "视频理解"]);
  });
});

describe("getGatewayModelTypeLabels · VIDEO", () => {
  it("labels wan3.0-video as All-in-One 文生/图生/参考生", () => {
    expect(
      getGatewayModelTypeLabels({
        modelKey: "wan3.0-video",
        role: "VIDEO",
      }),
    ).toEqual(["文生视频", "图生视频", "参考生视频", "多参考图"]);
  });
});

describe("SBV1_IMAGE_MODEL_KEYS", () => {
  it("includes image-edit models for the image node picker", () => {
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("qwen-image-edit");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("qwen-image-edit-max");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("qwen-image-3.0-pro");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("wan2.7-image-pro");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("wan2.6-image");
    expect(SBV1_IMAGE_MODEL_KEYS).toContain("google/nano-banana-edit");
  });
});
