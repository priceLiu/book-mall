import { describe, expect, it } from "vitest";

import {
  enrichOutfitKlingMotionControlPrompt,
  hasOutfitDualRefInputs,
  isLikelyOutfitPortraitModelUrl,
  resolveOutfitKlingMotionControlInputImage,
  resolveOutfitShotGenerateRoute,
  shouldOutfitUseDualRefR2vFallback,
} from "@/lib/ecom/ecom-outfit-video-kling-input";

describe("ecom-outfit-video-kling-input", () => {
  it("detects model-library portrait paths", () => {
    expect(
      isLikelyOutfitPortraitModelUrl(
        "https://tool-mall.oss-cn-guangzhou.aliyuncs.com/ecom/model-library/female-214.jpg",
      ),
    ).toBe(true);
  });

  it("detects dual ref inputs", () => {
    expect(
      hasOutfitDualRefInputs(
        "https://x/model.jpg",
        "https://x/clothing.jpg",
      ),
    ).toBe(true);
    expect(hasOutfitDualRefInputs("https://x/same.jpg", "https://x/same.jpg")).toBe(false);
  });

  it("falls back to R2V when Kling selected with model + clothing", () => {
    expect(
      shouldOutfitUseDualRefR2vFallback("kling-3.0/motion-control", {
        modelImageUrl: "https://x/model.jpg",
        clothingImageUrl: "https://x/clothing.jpg",
      }),
    ).toBe(true);

    const route = resolveOutfitShotGenerateRoute("kling-3.0/motion-control", {
      modelImageUrl: "https://x/model.jpg",
      clothingImageUrl: "https://x/clothing.jpg",
    });
    expect(route.kind).toBe("bailian-r2v");
    expect(route.modelKey).toBe("wan2.7-r2v");
    expect(route.autoFallbackFromKling).toBe(true);
  });

  it("keeps Kling when only model ref", () => {
    const route = resolveOutfitShotGenerateRoute("kling-3.0/motion-control", {
      modelImageUrl: "https://x/model.jpg",
      clothingImageUrl: "https://x/model.jpg",
    });
    expect(route.kind).toBe("kling");
  });

  it("uses model image only for Kling input", () => {
    expect(resolveOutfitKlingMotionControlInputImage("https://x/model.jpg")).toBe(
      "https://x/model.jpg",
    );
  });

  it("enriches prompt without split-layout wording", () => {
    const prompt = enrichOutfitKlingMotionControlPrompt("竖屏电商", {
      hasSeparateClothingRef: true,
    });
    expect(prompt).toContain("全身出镜");
    expect(prompt).not.toContain("左右拼接");
  });
});
