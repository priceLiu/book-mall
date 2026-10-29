import { describe, expect, it } from "vitest";
import {
  nextPreviewRevealHold,
  PREVIEW_REVEAL_RUNNING,
  previewRevealHolding,
} from "@/lib/canvas/preview-reveal-hold";

const url = "https://cdn.example/scene.png";

describe("nextPreviewRevealHold", () => {
  it("does not cover an existing image when the card first opens", () => {
    expect(nextPreviewRevealHold(null, false, false, url, false)).toBeNull();
  });

  it("keeps the generating cover after success until the image is ready", () => {
    expect(
      nextPreviewRevealHold(PREVIEW_REVEAL_RUNNING, false, false, url, false),
    ).toBe(url);
    expect(previewRevealHolding(url, url)).toBe(true);
  });

  it("keeps the cover while the preview url has not been written yet", () => {
    expect(
      nextPreviewRevealHold(PREVIEW_REVEAL_RUNNING, false, false, undefined, false),
    ).toBe(PREVIEW_REVEAL_RUNNING);
  });

  it("drops the cover once the image is ready or the run failed", () => {
    expect(
      nextPreviewRevealHold(url, false, false, url, true),
    ).toBeNull();
    expect(
      nextPreviewRevealHold(PREVIEW_REVEAL_RUNNING, false, true, undefined, false),
    ).toBeNull();
  });
});
