import { describe, expect, it } from "vitest";

import {
  BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE,
  BACKGROUND_REPLACE_REF_MENTION,
  BACKGROUND_REPLACE_SUBJECT_MENTION,
  buildBackgroundReplaceMentionRefs,
} from "@/lib/background-replace-mentions";
import { SEMANTIC_REF_TOKEN_RE } from "@/lib/product-design-mention-tokens";
import {
  DEFAULT_BACKGROUND_REPLACE_FORM,
  canSubmitBackgroundReplace,
} from "@/lib/background-replace-types";

describe("canSubmitBackgroundReplace", () => {
  it("defaults to Seedream and requires a scene prompt or reference image", () => {
    expect(DEFAULT_BACKGROUND_REPLACE_FORM.modelKey).toBe("doubao-seedream-5-0-pro");
    expect(canSubmitBackgroundReplace(DEFAULT_BACKGROUND_REPLACE_FORM, true)).toBe(
      false,
    );
    expect(
      canSubmitBackgroundReplace(
        { ...DEFAULT_BACKGROUND_REPLACE_FORM, refPrompt: "cafe" },
        false,
      ),
    ).toBe(false);
    expect(
      canSubmitBackgroundReplace(
        { ...DEFAULT_BACKGROUND_REPLACE_FORM, refPrompt: "cafe" },
        true,
      ),
    ).toBe(true);
  });

  it("lets Seedream submit with only a reference image", () => {
    expect(
      canSubmitBackgroundReplace(
        {
          ...DEFAULT_BACKGROUND_REPLACE_FORM,
          refImageUrl: "https://example.com/style.jpg",
        },
        true,
      ),
    ).toBe(true);
  });
});

describe("buildBackgroundReplaceMentionRefs", () => {
  it("only exposes boxed subjects as @图1框选 / @图2框选", () => {
    expect(
      buildBackgroundReplaceMentionRefs({
        subjectImageUrl: "https://example.com/a.jpg",
        subjectBbox: [179, 283, 796, 986],
        refImageUrl: "https://example.com/b.jpg",
        refBbox: [118, 331, 933, 871],
      }).map((r) => ({ token: r.token, cropBbox: r.cropBbox })),
    ).toEqual([
      { token: "@图1框选", cropBbox: [179, 283, 796, 986] },
      { token: "@图2框选", cropBbox: [118, 331, 933, 871] },
    ]);
    expect(
      buildBackgroundReplaceMentionRefs({
        subjectImageUrl: "https://example.com/a.jpg",
        subjectBbox: [179, 283, 796, 986],
        refImageUrl: "https://example.com/b.jpg",
        refBbox: null,
      }).map((r) => r.token),
    ).toEqual(["@图1框选"]);
  });

  it("keeps the official dual-bbox sentence as the @ example", () => {
    expect(BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE).toBe(
      "将 @图1框选 的主体放到 @图2框选 位置",
    );
    expect(BACKGROUND_REPLACE_DUAL_BBOX_EXAMPLE.match(SEMANTIC_REF_TOKEN_RE)).toEqual([
      BACKGROUND_REPLACE_SUBJECT_MENTION,
      BACKGROUND_REPLACE_REF_MENTION,
    ]);
  });
});
