import { describe, expect, it } from "vitest";

import { stripAutoRenderMediaFitReset } from "@/lib/canvas/jianying-auto-render-media-fit";

describe("stripAutoRenderMediaFitReset", () => {
  it("does not reset mediaFit on auto-render nodes", () => {
    const patch = stripAutoRenderMediaFitReset("jianying-auto-render-pro2", {
      videoUrl: "blob:abc",
      mediaFit: false,
      mediaFitKey: undefined,
      mediaNaturalW: 1080,
      mediaNaturalH: 1920,
    });

    expect(patch.mediaFit).toBeUndefined();
    expect(patch.mediaFitKey).toBeUndefined();
    expect(patch.mediaNaturalW).toBeUndefined();
    expect(patch.videoUrl).toBe("blob:abc");
  });

  it("passes through other node types", () => {
    const patch = stripAutoRenderMediaFitReset("sbv1-video-engine", {
      mediaFit: false,
    });
    expect(patch.mediaFit).toBe(false);
  });
});
