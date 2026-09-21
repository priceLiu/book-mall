import { describe, expect, it } from "vitest";

import {
  buildHitDetailPageImagePrompt,
  mergeHitDetailPageImageNegativePrompt,
} from "@/lib/ecom/detail-page-suite-hit/hit-image-prompt";
import { DETAIL_PAGE_SUITE_NEGATIVE_PROMPT } from "@/lib/ecom/detail-page-suite/types";

describe("buildHitDetailPageImagePrompt", () => {
  it("keeps scene-only prompt by default", () => {
    expect(
      buildHitDetailPageImagePrompt({
        positivePrompt: "场景：棚拍",
        slotCopy: "暖到心里",
        includeSlotCopyOnImage: false,
      }),
    ).toBe("场景：棚拍");
  });

  it("appends slot copy when enabled", () => {
    const out = buildHitDetailPageImagePrompt({
      positivePrompt: "场景：棚拍",
      slotCopy: "暖到心里",
      includeSlotCopyOnImage: true,
    });
    expect(out).toContain("场景：棚拍");
    expect(out).toContain("暖到心里");
  });
});

describe("mergeHitDetailPageImageNegativePrompt", () => {
  it("drops 文字 ban when burning copy", () => {
    const neg = mergeHitDetailPageImageNegativePrompt(undefined, true);
    expect(neg).not.toMatch(/文字/);
    expect(neg).toContain("乱码");
  });

  it("keeps default negative when not burning copy", () => {
    expect(mergeHitDetailPageImageNegativePrompt(undefined, false)).toBe(
      DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
    );
  });
});
