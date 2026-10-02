import { describe, expect, it } from "vitest";

import {
  brandViVisibleStepIds,
  BRAND_VI_STEP_IDS,
  isBrandViStepId,
} from "@/lib/ecom/ecom-brand-vi-steps";
import { isRefCapableEcomImageModel } from "@/lib/ecom/ecom-image-gen-invoke";
import { resolveHandCraftStyleFragment } from "@/lib/ecom/ecom-hand-craft-style-presets";

describe("brandViVisibleStepIds", () => {
  it("filters steps by project mode", () => {
    expect(brandViVisibleStepIds("emoji-only")).toEqual(["hero", "emoji"]);
    expect(brandViVisibleStepIds("vi-only")).toEqual(["hero", "logo", "vi-spec"]);
    expect(brandViVisibleStepIds("full")).toEqual([...BRAND_VI_STEP_IDS]);
  });

  it("recognizes step ids", () => {
    expect(isBrandViStepId("turnaround")).toBe(true);
    expect(isBrandViStepId("spec-kit")).toBe(false);
  });
});

describe("isRefCapableEcomImageModel", () => {
  it("includes IP workflow extras", () => {
    expect(isRefCapableEcomImageModel("gpt-image-2")).toBe(true);
    expect(isRefCapableEcomImageModel("seedream-4.5")).toBe(true);
    expect(isRefCapableEcomImageModel("kling-3.0-image")).toBe(true);
    expect(isRefCapableEcomImageModel("nano-banana-pro")).toBe(true);
    expect(isRefCapableEcomImageModel("nano-banana-2")).toBe(true);
  });
});

describe("resolveHandCraftStyleFragment", () => {
  it("uses custom text when preset is custom", () => {
    const fragment = resolveHandCraftStyleFragment({
      stylePresetId: "custom",
      styleCustomText: "哑光树脂，薄荷绿主色",
    });
    expect(fragment).toContain("薄荷绿");
  });
});
