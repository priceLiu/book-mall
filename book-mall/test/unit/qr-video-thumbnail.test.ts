import { describe, expect, it } from "vitest";

import { pickQrStaticThumbnailCandidate } from "@/lib/quick-replica/qr-video-thumbnail";
import type { QrWorkspaceDraft } from "@/lib/quick-replica/qr-types";

const baseDraft = (): QrWorkspaceDraft => ({
  category: "video",
  kind: "text-to-video",
  title: "demo",
  targetImageUrl: "",
  referenceVideoUrl: "",
  referenceAudioUrl: "",
  sourceAudioUrl: "",
  sceneImageUrls: [],
  prompt: "sunset",
  modelKey: "wan/2-7-text-to-video",
});

describe("pickQrStaticThumbnailCandidate", () => {
  it("uses scene reference image for video instead of output mp4", () => {
    const draft = {
      ...baseDraft(),
      sceneImageUrls: ["https://cdn.example/ref.jpg"],
    };
    expect(
      pickQrStaticThumbnailCandidate({
        mediaType: "video",
        outputUrl: "https://cdn.example/out.mp4",
        draft,
      }),
    ).toBe("https://cdn.example/ref.jpg");
  });

  it("returns null for pure text-to-video without reference images", () => {
    expect(
      pickQrStaticThumbnailCandidate({
        mediaType: "video",
        outputUrl: "https://cdn.example/out.mp4",
        draft: baseDraft(),
      }),
    ).toBeNull();
  });

  it("uses image output url for image jobs", () => {
    expect(
      pickQrStaticThumbnailCandidate({
        mediaType: "image",
        outputUrl: "https://cdn.example/out.png",
        draft: baseDraft(),
      }),
    ).toBe("https://cdn.example/out.png");
  });
});
