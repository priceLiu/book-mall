import { describe, expect, it } from "vitest";

import { buildCopyAwareImageGenPlan } from "@/lib/ecom/copy-layout/image-gen-copy-policy";

describe("buildCopyAwareImageGenPlan", () => {
  it("detail-hit without burn keeps scene prompt", () => {
    const plan = buildCopyAwareImageGenPlan({
      profile: "detail-hit",
      basePositivePrompt: "商品特写",
      slotCopy: "门襟压胶",
      burnCopyInImage: false,
    });
    expect(plan.promptForModel).toBe("商品特写");
    expect(plan.burnCopyInImage).toBe(false);
  });

  it("detail-hit with burn injects copy block", () => {
    const plan = buildCopyAwareImageGenPlan({
      profile: "detail-hit",
      basePositivePrompt: "商品特写",
      slotCopy: "门襟压胶",
      burnCopyInImage: true,
    });
    expect(plan.promptForModel).toContain("门襟压胶");
    expect(plan.burnCopyInImage).toBe(true);
  });

  it("ecom-poster default adds no-text instruction", () => {
    const plan = buildCopyAwareImageGenPlan({
      profile: "ecom-poster",
      basePositivePrompt: "促销氛围",
      slotCopy: "限时五折",
      burnCopyInImage: false,
    });
    expect(plan.promptForModel).toContain("无字摄影画面");
    expect(plan.burnCopyInImage).toBe(false);
  });
});
