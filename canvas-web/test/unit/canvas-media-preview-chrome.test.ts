import { describe, expect, it } from "vitest";

import {
  readElementShortSide,
  resolveCanvasMediaPreviewChrome,
} from "@/lib/canvas/canvas-media-preview-chrome";
import { resolveLibtvMediaPreviewUrl } from "@/lib/canvas/libtv-media-preview-url";

describe("resolveCanvasMediaPreviewChrome", () => {
  it("uses canvas baseline at 200px short side", () => {
    const c = resolveCanvasMediaPreviewChrome(200);
    expect(c.btnSizePx).toBe(64);
    expect(c.iconSizePx).toBe(32);
  });

  it("does not shrink below scale floor on small nodes", () => {
    const c = resolveCanvasMediaPreviewChrome(80);
    expect(c.btnSizePx).toBe(54);
    expect(c.iconSizePx).toBe(27);
  });

  it("scales up for large nodes up to cap", () => {
    const c = resolveCanvasMediaPreviewChrome(360);
    expect(c.btnSizePx).toBe(99);
    expect(c.iconSizePx).toBe(50);
  });

  it("readElementShortSide falls back when no element", () => {
    expect(readElementShortSide(null)).toBe(200);
  });
});

describe("resolveLibtvMediaPreviewUrl", () => {
  it("prefers runtime ephemeral when data.ossUrl is stale after regen", () => {
    const url = resolveLibtvMediaPreviewUrl({
      ossUrl: "https://bucket.oss-cn-shanghai.aliyuncs.com/canvas/old.png",
      runtime: {
        status: "done",
        ephemeralUrl: "https://vendor.example/new.png",
      },
    });
    expect(url).toBe("https://vendor.example/new.png");
  });
});
