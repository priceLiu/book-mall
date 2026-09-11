import { describe, expect, it } from "vitest";

import {
  hdResolutionForScale,
  hdScaleLabel,
  hdUpscaleDockPrompt,
  snapHdGridCellAspectRatio,
} from "@/lib/canvas/libtv-grid-split-hd";

describe("libtv-grid-split-hd", () => {
  it("maps scale to resolution", () => {
    expect(hdResolutionForScale("1")).toBe("1K");
    expect(hdResolutionForScale("2")).toBe("2K");
    expect(hdResolutionForScale("4")).toBe("4K");
  });

  it("builds upscale prompt without source prompt", () => {
    const prompt = hdUpscaleDockPrompt("2");
    expect(prompt).not.toContain("Design");
    expect(prompt).toContain("2倍");
    expect(prompt).toContain("超分辨率增强");
  });

  it("snaps grid cell pixels to nearest dock ratio (not default 1:1)", () => {
    expect(snapHdGridCellAspectRatio(640, 360)).toBe("16:9");
    expect(snapHdGridCellAspectRatio(360, 640)).toBe("9:16");
    expect(snapHdGridCellAspectRatio(1500, 750)).toBe("2:1");
  });
});
