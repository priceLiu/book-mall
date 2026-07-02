import { describe, expect, it } from "vitest";

import { buildQrTextToVideoCreateArgs } from "@/lib/canvas/kie-video-tool-builders";
import {
  getQrTextToVideoModelDef,
  QR_TEXT_TO_VIDEO_MODELS,
  validateTextToVideoDraft,
} from "@/lib/quick-replica/qr-text-to-video-models";

describe("qr-text-to-video-models", () => {
  it("validates prompt required", () => {
    expect(
      validateTextToVideoDraft({
        modelKey: "kling/v3-turbo-text-to-video",
        prompt: "",
        sceneImageUrls: [],
        targetImageUrl: "",
      }),
    ).toBe("请填写提示词");
  });

  it("HappyHorse requires refs and valid image tokens", () => {
    expect(
      validateTextToVideoDraft({
        modelKey: "happyhorse-1-1/reference-to-video",
        prompt: "dance with [Image 2]",
        sceneImageUrls: ["https://example.com/a.jpg"],
        targetImageUrl: "",
      }),
    ).toMatch(/Image 2/);

    expect(
      validateTextToVideoDraft({
        modelKey: "happyhorse-1-1/reference-to-video",
        prompt: "dance with [Image 1]",
        sceneImageUrls: ["https://example.com/a.jpg"],
        targetImageUrl: "",
      }),
    ).toBeNull();
  });

  it("pure T2V models allow empty refs", () => {
    expect(
      validateTextToVideoDraft({
        modelKey: "wan/2-7-text-to-video",
        prompt: "a cat walking",
        sceneImageUrls: [],
        targetImageUrl: "",
      }),
    ).toBeNull();
  });
});

describe("buildQrTextToVideoCreateArgs", () => {
  it("builds kling turbo T2V", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "kling/v3-turbo-text-to-video",
      prompt: "sunset beach",
      duration: 5,
      resolution: "1080p",
      aspectRatio: "9:16",
    });
    expect(out.model).toBe("kling/v3-turbo-text-to-video");
    expect(out.input).toMatchObject({
      prompt: "sunset beach",
      duration: "5",
      resolution: "1080p",
      aspect_ratio: "9:16",
    });
  });

  it("passes grok image_urls when refs provided", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "grok-imagine/image-to-video",
      prompt: "motion",
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      mode: "normal",
      duration: 6,
    });
    expect(out.input.image_urls).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
  });

  it("builds HappyHorse with reference_image array", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "happyhorse-1-1/reference-to-video",
      prompt: "[Image 1] dances",
      imageUrls: ["https://example.com/a.jpg"],
      resolution: "1080p",
      aspectRatio: "16:9",
      duration: 5,
    });
    expect(out.model).toBe("happyhorse-1-1/reference-to-video");
    expect(out.input.reference_image).toEqual(["https://example.com/a.jpg"]);
  });

  it("builds kling 3.0 text-to-video without empty image_urls", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "kling-3.0/video",
      prompt: "冰锁",
      imageUrls: [],
      aspectRatio: "16:9",
      duration: 5,
      mode: "pro",
      sound: true,
    });
    expect(out.model).toBe("kling-3.0/video");
    expect(out.input.prompt).toBe("冰锁");
    expect(out.input.image_urls).toBeUndefined();
    expect(out.input).toMatchObject({
      duration: "5",
      aspect_ratio: "16:9",
      mode: "pro",
      multi_shots: false,
    });
  });

  it("builds kling 3.0 with first/last frame when two refs", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "kling-3.0/video",
      prompt: "motion",
      imageUrls: [
        "https://example.com/first.jpg",
        "https://example.com/last.jpg",
      ],
      aspectRatio: "9:16",
      mode: "std",
    });
    expect(out.input.image_urls).toEqual([
      "https://example.com/first.jpg",
      "https://example.com/last.jpg",
    ]);
  });

  it("builds seedance 2.0 text-to-video without refs", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "doubao-seedance-2.0",
      prompt: "sunset over ocean",
      imageUrls: [],
      aspectRatio: "16:9",
      resolution: "1080p",
      duration: 5,
      sound: false,
    });
    expect(out.model).toBe("doubao-seedance-2.0");
    expect(out.input.content).toEqual([{ type: "text", text: "sunset over ocean" }]);
    expect(out.input.generate_audio).toBe(false);
  });

  it("builds grok without empty image_urls", () => {
    const out = buildQrTextToVideoCreateArgs({
      modelKey: "grok-imagine/image-to-video",
      prompt: "test",
      imageUrls: [],
    });
    expect(out.input.image_urls).toBeUndefined();
  });

  it("defaults first model def for unknown key", () => {
    expect(getQrTextToVideoModelDef("unknown").modelKey).toBe(
      QR_TEXT_TO_VIDEO_MODELS[0]!.modelKey,
    );
  });
});
