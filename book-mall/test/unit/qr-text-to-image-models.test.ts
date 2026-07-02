import { describe, expect, it } from "vitest";

import { buildQrTextToImageCreateArgs } from "@/lib/canvas/qr-image-builders";
import {
  getQrTextToImageModelDef,
  resolveQrTextToImageGatewayModelKey,
  validateTextToImageDraft,
} from "@/lib/quick-replica/qr-text-to-image-models";

describe("qr-text-to-image-models", () => {
  it("validates prompt required", () => {
    expect(
      validateTextToImageDraft({
        modelKey: "lib-nano-pro",
        prompt: "",
        sceneImageUrls: [],
        targetImageUrl: "",
      }),
    ).toBe("请填写提示词");
  });

  it("grok rejects reference images", () => {
    expect(
      validateTextToImageDraft({
        modelKey: "grok-imagine/text-to-image",
        prompt: "a cat",
        sceneImageUrls: ["https://example.com/a.jpg"],
        targetImageUrl: "",
      }),
    ).toBe("当前模型不支持参考图，请移除参考图");
  });

  it("enforces max reference images", () => {
    expect(
      validateTextToImageDraft({
        modelKey: "qwen-text-to-image",
        prompt: "a cat",
        sceneImageUrls: [
          "https://example.com/a.jpg",
          "https://example.com/b.jpg",
        ],
        targetImageUrl: "",
      }),
    ).toBe("参考图最多 1 张");
  });

  it("maps lib-nano-pro to gateway nano-banana-pro", () => {
    expect(resolveQrTextToImageGatewayModelKey("lib-nano-pro")).toBe(
      "nano-banana-pro",
    );
  });

  it("builds nano pro create args with refs", () => {
    const out = buildQrTextToImageCreateArgs({
      modelKey: "lib-nano-pro",
      prompt: "sunset",
      imageUrls: ["https://example.com/ref.jpg"],
      aspectRatio: "16:9",
      resolution: "2K",
      outputFormat: "png",
    });
    expect(out.model).toBe("nano-banana-pro");
    expect(out.input.prompt).toBe("sunset");
    expect(out.input.image_input).toEqual(["https://example.com/ref.jpg"]);
    expect(out.input.aspect_ratio).toBe("16:9");
    expect(out.input.resolution).toBe("2K");
    expect(out.input.output_format).toBe("png");
  });

  it("builds seedream quality from mode", () => {
    const out = buildQrTextToImageCreateArgs({
      modelKey: "seedream-5-lite",
      prompt: "portrait",
      aspectRatio: "1:1",
      mode: "high",
    });
    expect(out.model).toBe("seedream/5-lite-text-to-image");
    expect(out.input.quality).toBe("high");
  });

  it("defaults create-image model def", () => {
    expect(getQrTextToImageModelDef("unknown").modelKey).toBe("lib-nano-pro");
  });
});
