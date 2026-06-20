import { describe, expect, it } from "vitest";
import {
  buildPortraitAssetUri,
  formatVolcenginePortraitActionError,
  sanitizeVolcenginePortraitName,
  VOLCENGINE_PORTRAIT_NAME_MAX_LEN,
} from "@/lib/gateway/volcengine-portrait-actions";
import { normalizePortraitAssetRefs } from "@/lib/canvas/canvas-portrait-import-service";
import { buildCanvasVideoVolcengineInput } from "@/lib/canvas/canvas-video-volcengine";

describe("buildPortraitAssetUri", () => {
  it("prefixes asset id", () => {
    expect(buildPortraitAssetUri("asset-abc")).toBe("asset://asset-abc");
    expect(buildPortraitAssetUri("asset://asset-abc")).toBe("asset://asset-abc");
  });
});

describe("formatVolcenginePortraitActionError", () => {
  it("maps empty 404 to entitlement guidance", () => {
    const msg = formatVolcenginePortraitActionError({
      action: "CreateAsset",
      status: 404,
      text: "",
      json: null,
    });
    expect(msg).toContain("人像库");
  });
});

describe("sanitizeVolcenginePortraitName", () => {
  it("truncates to 64 characters", () => {
    const long = "a".repeat(80);
    expect(sanitizeVolcenginePortraitName(long)).toHaveLength(
      VOLCENGINE_PORTRAIT_NAME_MAX_LEN,
    );
  });

  it("counts unicode code points", () => {
    const long = "人".repeat(80);
    expect(sanitizeVolcenginePortraitName(long)).toHaveLength(
      VOLCENGINE_PORTRAIT_NAME_MAX_LEN,
    );
  });

  it("uses fallback when empty", () => {
    expect(sanitizeVolcenginePortraitName("  ", "canvas-portrait")).toBe(
      "canvas-portrait",
    );
  });
});

describe("normalizePortraitAssetRefs", () => {
  it("accepts strings and objects", () => {
    expect(
      normalizePortraitAssetRefs([
        "asset://asset-1",
        { url: "asset://asset-2", role: "first_frame" },
        { url: "https://x" },
      ]),
    ).toEqual([
      { url: "asset://asset-1", role: "reference_image" },
      { url: "asset://asset-2", role: "first_frame" },
    ]);
  });

  it("dedupes repeated asset urls", () => {
    expect(
      normalizePortraitAssetRefs([
        "asset://asset-1",
        { url: "asset://asset-1", role: "reference_image" },
        { url: "asset://asset-2" },
      ]),
    ).toEqual([
      { url: "asset://asset-1", role: "reference_image" },
      { url: "asset://asset-2", role: "reference_image" },
    ]);
  });
});

describe("buildCanvasVideoVolcengineInput with assetRefs", () => {
  it("includes asset:// in reference mode", () => {
    const { body } = buildCanvasVideoVolcengineInput({
      modelKey: "doubao-seedance-2.0",
      prompt: "walk forward",
      imageUrl: "https://scene.example/a.jpg",
      assetRefs: [{ url: "asset://asset-portrait-1" }],
      forceReferenceMode: true,
    });
    const content = body.content as Array<Record<string, unknown>>;
    const urls = content
      .filter((c) => c.type === "image_url")
      .map((c) => (c.image_url as { url?: string })?.url);
    expect(urls).toContain("asset://asset-portrait-1");
    expect(urls).toContain("https://scene.example/a.jpg");
  });

  it("supports asset:// first and last frame without https", () => {
    const { body } = buildCanvasVideoVolcengineInput({
      modelKey: "doubao-seedance-2.0",
      prompt: "morph",
      imageUrl: "",
      assetRefs: [
        { url: "asset://asset-first", role: "first_frame" },
        { url: "asset://asset-last", role: "last_frame" },
      ],
      forceReferenceMode: false,
    });
    const content = body.content as Array<Record<string, unknown>>;
    const frames = content.filter((c) => c.type === "image_url");
    expect(frames).toHaveLength(2);
    expect(frames[0]).toMatchObject({
      image_url: { url: "asset://asset-first" },
      role: "first_frame",
    });
    expect(frames[1]).toMatchObject({
      image_url: { url: "asset://asset-last" },
      role: "last_frame",
    });
  });
});
