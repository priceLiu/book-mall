import { describe, expect, it } from "vitest";

import {
  aspectRatioForImageSize,
  coerceImageSizeForAspectRatio,
  defaultImageSizeForModel,
  filterImageSizeOptionsByEcomRatio,
  imageSizeOptionsForModel,
} from "@/lib/storyboard-image-size-options";

describe("storyboard image size · 9:16", () => {
  it("filters 9:16 sizes separately from 3:4", () => {
    const opts = filterImageSizeOptionsByEcomRatio(
      imageSizeOptionsForModel("wan2.7-image"),
      "9:16",
    );
    expect(opts.every((o) => aspectRatioForImageSize(o.value) === "9:16")).toBe(true);
    expect(opts.some((o) => o.value === "720*1280")).toBe(true);
    expect(opts.some((o) => o.value === "720*960")).toBe(false);
  });

  it("defaults wan2.7 to 9:16 pixel size", () => {
    expect(defaultImageSizeForModel("wan2.7-image", "9:16")).toBe("1080*1920");
  });

  it("coerces mismatched cached size before generate", () => {
    expect(coerceImageSizeForAspectRatio("720*960", "9:16", "wan2.7-image")).toBe(
      "1080*1920",
    );
  });
});
