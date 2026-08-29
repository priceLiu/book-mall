import { describe, expect, it } from "vitest";

import {
  assertEcomStoryboardImageEditRefs,
  ecomStoryboardImageEditMaxRefs,
  ecomStoryboardImageEditRequiresRefs,
  isEcomStoryboardImageEditModel,
} from "@/lib/ecom/ecom-storyboard-image-edit";

describe("ecom-storyboard-image-edit", () => {
  it("recognizes edit-capable storyboard image models", () => {
    for (const key of [
      "qwen-image-edit",
      "qwen-image-edit-max",
      "wan2.7-image-pro",
      "qwen-image-3.0-pro",
    ]) {
      expect(isEcomStoryboardImageEditModel(key)).toBe(true);
    }
    expect(isEcomStoryboardImageEditModel("wan2.7-image")).toBe(false);
  });

  it("requires refs only for qwen-image-edit*", () => {
    expect(ecomStoryboardImageEditRequiresRefs("qwen-image-edit")).toBe(true);
    expect(ecomStoryboardImageEditRequiresRefs("qwen-image-edit-max")).toBe(true);
    expect(ecomStoryboardImageEditRequiresRefs("wan2.7-image-pro")).toBe(false);
    expect(ecomStoryboardImageEditRequiresRefs("qwen-image-3.0-pro")).toBe(false);
  });

  it("caps reference images per model", () => {
    expect(ecomStoryboardImageEditMaxRefs("qwen-image-edit")).toBe(3);
    expect(ecomStoryboardImageEditMaxRefs("qwen-image-3.0-pro")).toBe(3);
    expect(ecomStoryboardImageEditMaxRefs("wan2.7-image-pro")).toBe(5);
  });

  it("throws when qwen-image-edit invoked without refs", () => {
    expect(() =>
      assertEcomStoryboardImageEditRefs("qwen-image-edit", 0),
    ).toThrow(/至少 1 张参考图/);
    expect(() =>
      assertEcomStoryboardImageEditRefs("qwen-image-edit", 1),
    ).not.toThrow();
    expect(() =>
      assertEcomStoryboardImageEditRefs("wan2.7-image-pro", 0),
    ).not.toThrow();
  });
});
