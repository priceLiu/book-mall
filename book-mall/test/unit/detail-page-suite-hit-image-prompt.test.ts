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
    expect(out).toContain("「暖到心里」");
    expect(out).toContain("不得把上述句子渲染成画面上的文字");
  });

  it("truncates overly long burn-in copy", () => {
    const long = "a".repeat(60);
    const out = buildHitDetailPageImagePrompt({
      positivePrompt: "场景",
      slotCopy: long,
      includeSlotCopyOnImage: true,
    });
    expect(out).toContain(`「${"a".repeat(48)}」`);
  });
});

describe("mergeHitDetailPageImageNegativePrompt", () => {
  it("relaxes plain-text ban when burning copy", () => {
    const neg = mergeHitDetailPageImageNegativePrompt(undefined, true);
    expect(neg).not.toContain("文字，");
    expect(neg).toContain("乱码");
    expect(neg).toContain("长段落");
  });

  it("keeps default negative when not burning copy", () => {
    expect(mergeHitDetailPageImageNegativePrompt(undefined, false)).toBe(
      DETAIL_PAGE_SUITE_NEGATIVE_PROMPT,
    );
  });
});
