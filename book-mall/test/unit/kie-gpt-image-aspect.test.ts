import { describe, expect, it } from "vitest";

import {
  buildKieImageCreateArgs,
  resolveKieGptImageAspectRatio,
} from "@/lib/canvas/providers/kie";

describe("KIE GPT Image aspect_ratio", () => {
  it("maps 4:5 → 3:4 and 5:4 → 4:3", () => {
    expect(resolveKieGptImageAspectRatio("4:5")).toBe("3:4");
    expect(resolveKieGptImageAspectRatio("5:4")).toBe("4:3");
    expect(resolveKieGptImageAspectRatio("1:1")).toBe("1:1");
    expect(resolveKieGptImageAspectRatio("3:4")).toBe("3:4");
  });

  it("does not send 4:5 / 5:4 on gpt-image-2 createTask input", () => {
    expect(
      buildKieImageCreateArgs({
        modelKey: "gpt-image-2",
        prompt: "poster",
        params: { aspect_ratio: "4:5", resolution: "2K" },
      }).input.aspect_ratio,
    ).toBe("3:4");
    expect(
      buildKieImageCreateArgs({
        modelKey: "gpt-image-1",
        prompt: "poster",
        params: { aspect_ratio: "5:4", quality: "high" },
      }).input.aspect_ratio,
    ).toBe("4:3");
    expect(
      buildKieImageCreateArgs({
        modelKey: "4o-image",
        prompt: "poster",
        params: { aspect_ratio: "4:5" },
      }).input.aspect_ratio,
    ).toBe("3:4");
  });

  it("leaves 4:5 intact for non-GPT KIE image models", () => {
    expect(
      buildKieImageCreateArgs({
        modelKey: "nano-banana-2",
        prompt: "poster",
        params: { aspect_ratio: "4:5", resolution: "2K" },
      }).input.aspect_ratio,
    ).toBe("9:16");
  });

  it("maps 4:3 to 16:9 for nano-banana-pro", () => {
    expect(
      buildKieImageCreateArgs({
        modelKey: "nano-banana-pro",
        prompt: "character",
        params: { aspect_ratio: "4:3", resolution: "2K" },
      }).input.aspect_ratio,
    ).toBe("16:9");
    expect(
      buildKieImageCreateArgs({
        modelKey: "nano-banana-pro",
        prompt: "character",
        params: { aspect_ratio: "2:1", resolution: "2K" },
      }).input.aspect_ratio,
    ).toBe("16:9");
  });
});
