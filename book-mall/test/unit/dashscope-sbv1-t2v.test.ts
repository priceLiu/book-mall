import { describe, expect, it } from "vitest";

import {
  buildDashscopeSbv1T2vVideoBody,
  buildDashscopeWan30Media,
  dashscopeSbv1T2vModelToR2v,
  isDashscopeSbv1TextToVideoModel,
  resolveDashscopeT2vRefMismatchMessage,
} from "@/lib/canvas/dashscope-sbv1-t2v";

describe("dashscopeSbv1T2vModelToR2v", () => {
  it("maps HappyHorse / Wan T2V to matching R2V keys", () => {
    expect(dashscopeSbv1T2vModelToR2v("happyhorse-1.1-t2v")).toBe(
      "happyhorse-1.1-r2v",
    );
    expect(dashscopeSbv1T2vModelToR2v("wan2.7-t2v-2026-04-25")).toBe(
      "wan2.7-r2v",
    );
  });
});

describe("wan3.0-video", () => {
  it("is registered as DashScope T2V", () => {
    expect(isDashscopeSbv1TextToVideoModel("wan3.0-video")).toBe(true);
    expect(isDashscopeSbv1TextToVideoModel("wan3.0-video-prime")).toBe(true);
  });

  it("builds wan3 body with 480P and 30s cap", () => {
    const body = buildDashscopeSbv1T2vVideoBody({
      prompt: "test",
      aspectRatio: "16:9",
      resolution: "480P",
      durationSec: 45,
      modelKey: "wan3.0-video",
    });
    expect(body.parameters.resolution).toBe("480P");
    expect(body.parameters.duration).toBe(30);
    expect(body.parameters.prompt_extend).toBe(true);
    expect(body.input.prompt).toBe("test");
    expect(body.input.media).toBeUndefined();
  });

  it("builds wan3 omni body with prompt_extend, audio and adaptive ratio", () => {
    const body = buildDashscopeSbv1T2vVideoBody({
      prompt: "图1参考",
      aspectRatio: "16:9",
      resolution: "720P",
      durationSec: 5,
      promptExtend: false,
      generateAudio: false,
      modelKey: "wan3.0-video",
      media: [
        { type: "reference_video", url: "https://oss.example/ref.mp4" },
        { type: "reference_image", url: "https://oss.example/a.jpg" },
      ],
    });
    expect(body.parameters.prompt_extend).toBe(false);
    expect(body.parameters.audio).toBe(false);
    expect(body.parameters.ratio).toBe("adaptive");
  });

  it("allows reference images (All-in-One, no R2V mismatch)", () => {
    expect(
      resolveDashscopeT2vRefMismatchMessage("wan3.0-video", [
        "https://oss.example/a.png",
      ]),
    ).toBeNull();
  });

  it("builds first_frame media for i2v", () => {
    const media = buildDashscopeWan30Media({
      firstFrameUrl: "https://oss.example/first.png",
    });
    expect(media).toEqual([
      { type: "first_frame", url: "https://oss.example/first.png" },
    ]);
  });

  it("uses reference_image only when identity refs accompany first frame", () => {
    const media = buildDashscopeWan30Media({
      firstFrameUrl: "https://oss.example/first.png",
      referenceImageUrls: [
        "https://oss.example/first.png",
        "https://oss.example/product.png",
      ],
    });
    expect(media).toEqual([
      { type: "reference_image", url: "https://oss.example/first.png" },
      { type: "reference_image", url: "https://oss.example/product.png" },
    ]);
  });

  it("omni keeps both images when firstFrameUrl duplicates first ref", () => {
    const media = buildDashscopeWan30Media({
      dockMode: "omni",
      firstFrameUrl: "https://oss.example/char-a.png",
      referenceImageUrls: [
        "https://oss.example/char-a.png",
        "https://oss.example/char-b.png",
      ],
    });
    expect(media.filter((m) => m.type === "reference_image")).toHaveLength(2);
  });

  it("omni path sends all refs as reference_image without first_frame", () => {
    const media = buildDashscopeWan30Media({
      firstFrameUrl: "",
      referenceImageUrls: [
        "https://oss.example/char-a.png",
        "https://oss.example/char-b.png",
      ],
    });
    expect(media).toEqual([
      { type: "reference_image", url: "https://oss.example/char-a.png" },
      { type: "reference_image", url: "https://oss.example/char-b.png" },
    ]);
  });

  it("omni path sends reference_video before reference_image", () => {
    const media = buildDashscopeWan30Media({
      dockMode: "omni",
      referenceVideoUrls: ["https://oss.example/ref.mp4"],
      referenceImageUrls: [
        "https://oss.example/char-a.png",
        "https://oss.example/char-b.png",
      ],
    });
    expect(media).toEqual([
      { type: "reference_video", url: "https://oss.example/ref.mp4" },
      { type: "reference_image", url: "https://oss.example/char-a.png" },
      { type: "reference_image", url: "https://oss.example/char-b.png" },
    ]);
  });

  it("omni excludes video URLs from reference_image", () => {
    const media = buildDashscopeWan30Media({
      dockMode: "omni",
      referenceVideoUrls: ["https://oss.example/ref.mp4"],
      referenceImageUrls: [
        "https://oss.example/node-video/abc123",
        "https://oss.example/char-a.png",
      ],
    });
    expect(media).toEqual([
      { type: "reference_video", url: "https://oss.example/ref.mp4" },
      { type: "reference_image", url: "https://oss.example/char-a.png" },
    ]);
  });

  it("forces omni media types when reference video is attached in i2v mode", () => {
    const media = buildDashscopeWan30Media({
      dockMode: "i2v",
      firstFrameUrl: "https://oss.example/first.png",
      referenceVideoUrls: ["https://oss.example/ref.mp4"],
    });
    expect(media).toEqual([
      { type: "reference_video", url: "https://oss.example/ref.mp4" },
      { type: "reference_image", url: "https://oss.example/first.png" },
    ]);
  });
});

describe("resolveDashscopeT2vRefMismatchMessage", () => {
  it("returns null when no reference images", () => {
    expect(
      resolveDashscopeT2vRefMismatchMessage("happyhorse-1.1-t2v", []),
    ).toBeNull();
  });

  it("returns mismatch message when T2V has reference images", () => {
    const msg = resolveDashscopeT2vRefMismatchMessage("happyhorse-1.1-t2v", [
      "https://oss.example/a.png",
      "https://oss.example/b.png",
    ]);
    expect(msg).toContain("happyhorse-1.1-t2v");
    expect(msg).toContain("happyhorse-1.1-r2v");
    expect(msg).toContain("2 张");
  });

  it("returns null for non-T2V models with refs", () => {
    expect(
      resolveDashscopeT2vRefMismatchMessage("doubao-seedance-2.0", [
        "https://oss.example/a.png",
      ]),
    ).toBeNull();
  });
});
