import { describe, expect, it } from "vitest";

import {
  hdResolutionForScale,
  hdScaleLabel,
  hdUpscaleDockPrompt,
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
});
