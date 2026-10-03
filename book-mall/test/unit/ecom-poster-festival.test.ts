import { describe, expect, it } from "vitest";

import { getPosterFestivalPack } from "@/lib/ecom/ecom-poster-festival-packs";
import { buildMarketingPosterScenePrompt } from "@/lib/ecom/ecom-image-processing-presets";

describe("ecom poster festival", () => {
  it("resolves festival pack by id", () => {
    expect(getPosterFestivalPack("618")?.label).toContain("618");
  });

  it("buildMarketingPosterScenePrompt includes no-text hint", () => {
    const p = buildMarketingPosterScenePrompt({
      sceneDescription: "羽绒服特写",
      styleId: "promo-sale",
      festivalHint: "大促",
      aspectRatio: "1:1",
    });
    expect(p).toContain("no readable text");
    expect(p).toContain("羽绒服");
  });
});
