import { describe, expect, it } from "vitest";
import {
  formatSubtitlePreviewAspectLabel,
  resolveSubtitlePreviewFontSizePx,
  resolveSubtitlePreviewFrameSize,
} from "@private/media-render-subtitle-style/subtitle-preview";

describe("subtitle preview frame", () => {
  it("uses the source frame aspect instead of a fixed 9:16 box", () => {
    const landscape = resolveSubtitlePreviewFrameSize({
      aspectWidth: 1920,
      aspectHeight: 1080,
      maxWidthPx: 320,
      maxHeightPx: 220,
    });
    expect(landscape.width).toBeGreaterThan(landscape.height);
    expect(landscape.width / landscape.height).toBeCloseTo(16 / 9, 2);

    const portrait = resolveSubtitlePreviewFrameSize({
      aspectWidth: 1080,
      aspectHeight: 1920,
      maxWidthPx: 320,
      maxHeightPx: 220,
    });
    expect(portrait.height).toBeGreaterThan(portrait.width);
    expect(formatSubtitlePreviewAspectLabel(1920, 1080)).toBe("16:9");
  });

  it("scales ASS font size by the preview frame height", () => {
    const style = { fontKey: "heiti" as const, sizeKey: "large" as const, fontSize: 12 };
    expect(resolveSubtitlePreviewFontSizePx(style, 288)).toBe(12);
    expect(resolveSubtitlePreviewFontSizePx(style, 1080)).toBeCloseTo(45, 5);
  });
});
