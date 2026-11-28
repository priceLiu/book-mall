import { describe, expect, it } from "vitest";

import { assertImageEditorGradePrompt } from "@/lib/ecom/image-editor-clear-grade";
import { IMAGE_EDITOR_FILTER_RECIPES } from "@/lib/ecom/image-editor-filter-recipes";
import { IMAGE_EDITOR_FILTER_PROMPTS, imageEditorFilterPromptLabel } from "@/lib/ecom/image-editor-filter-prompts";

const BUILTIN_GRADE_IDS = [
  "clear",
  "grayscale",
  "invert",
  "vivid",
  "dehaze",
  "texture",
  "natural",
  "fade",
  "sharpen",
  "aqua",
  "hyper",
  "soft",
  "cream",
  "film",
  "cool-white",
  "warm-food",
  "muted",
  "lift",
  "darken",
  "contrast-up",
  "contrast-down",
  "warm",
  "cool",
  "highlight-up",
  "shadow-open",
  "highlight-roll",
  "skin-protect",
  "brand-color",
  "bg-light",
  "bg-dark",
  "product-true",
  "warm-white",
  "cool-white-balance",
  "white-bg",
  "food",
  "fabric",
  "metal-glass",
  "gift",
];

describe("image editor filter prompts", () => {
  it("covers every filter recipe and builtin grade id", () => {
    const ids = [...new Set([...Object.keys(IMAGE_EDITOR_FILTER_RECIPES), ...BUILTIN_GRADE_IDS])];
    for (const id of ids) {
      expect(IMAGE_EDITOR_FILTER_PROMPTS[id]?.length ?? 0, id).toBeGreaterThan(40);
      expect(() => assertImageEditorGradePrompt(id)).not.toThrow();
      expect(imageEditorFilterPromptLabel(id)?.trim(), id).toBeTruthy();
    }
  });
});