import { describe, expect, it } from "vitest";

import { hitSlotCopyRequired } from "@/lib/ecom/detail-page-suite-hit/hit-slot-copy-rules";

describe("hitSlotCopyRequired", () => {
  it("requires copy for banner and feature cards", () => {
    expect(
      hitSlotCopyRequired({ type: "full_banner", layout: "full_image" }),
    ).toBe(true);
    expect(
      hitSlotCopyRequired({ type: "feature_card", layout: "image_text_top_bottom" }),
    ).toBe(true);
  });

  it("optional for pure image scene when full_image layout", () => {
    expect(
      hitSlotCopyRequired({ type: "scene_image", layout: "full_image" }),
    ).toBe(false);
  });
});
