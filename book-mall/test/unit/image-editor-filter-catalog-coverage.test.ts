import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { assertImageEditorGradePrompt, gradeLocalRgba, gradeNamedPixel } from "@/lib/ecom/image-editor-clear-grade";
import { IMAGE_EDITOR_FILTER_PROMPTS, imageEditorFilterPrompt, imageEditorFilterPromptLabel } from "@/lib/ecom/image-editor-filter-prompts";
import { IMAGE_EDITOR_FILTER_RECIPES } from "@/lib/ecom/image-editor-filter-recipes";

const ROOT = resolve(__dirname, "../../..");
const CATALOG = readFileSync(resolve(ROOT, "e-commerce-toolkit/lib/image-editor-filter-catalog.ts"), "utf8");
const CLEAR_GRADE = readFileSync(resolve(ROOT, "book-mall/lib/ecom/image-editor-clear-grade.ts"), "utf8");

const catalogPicks = [...CATALOG.matchAll(/pick\("([^"]+)",\s*"([^"]+)"/g)].map((m) => ({ id: m[1], label: m[2] }));
const catalogById = new Map<string, string>();
for (const p of catalogPicks) {
  if (!catalogById.has(p.id)) catalogById.set(p.id, p.label);
}

const builtinRecipeIds = new Set(
  [...CLEAR_GRADE.matchAll(/^\s{2}"?([a-z0-9-]+)"?:\s*\{/gm)].map((m) => m[1]),
);
builtinRecipeIds.add("clear");
builtinRecipeIds.add("grayscale");
builtinRecipeIds.add("invert");

const MANUAL_PROMPT_WITHOUT_LABEL = new Set([
  "vivid",
  "clear",
  "natural",
  "dehaze",
  "texture",
  "sharpen",
  "fade",
  "film",
  "cream",
  "cool-white",
  "grayscale",
  "invert",
]);

describe("image editor filter catalog coverage", () => {
  it("each catalog id has prompt, recipe (or builtin), and runnable grade", () => {
    const labelsById = new Map<string, Set<string>>();
    for (const p of catalogPicks) {
      const set = labelsById.get(p.id) ?? new Set<string>();
      set.add(p.label);
      labelsById.set(p.id, set);
    }
    const labelConflicts = [...labelsById.entries()].filter(([, labels]) => labels.size > 1);
    expect(
      labelConflicts.map(([id, labels]) => `${id}: ${[...labels].join(" vs ")}`),
      "same id must use one label in all sections",
    ).toEqual([]);

    const data = new Uint8ClampedArray([200, 120, 80, 255, 40, 180, 220, 255, 60, 60, 60, 255, 255, 255, 255, 255]);
    const width = 2;
    const height = 2;

    for (const [id, label] of catalogById) {
      expect(IMAGE_EDITOR_FILTER_PROMPTS[id]?.length ?? 0, `${id} prompt`).toBeGreaterThan(40);
      expect(() => assertImageEditorGradePrompt(id)).not.toThrow();
      expect(imageEditorFilterPromptLabel(id), `${id} label`).toBe(label);

      const hasRecipe = builtinRecipeIds.has(id) || id in IMAGE_EDITOR_FILTER_RECIPES;
      expect(hasRecipe, `${id} recipe`).toBe(true);

      const prompt = imageEditorFilterPrompt(id) ?? "";
      if (!MANUAL_PROMPT_WITHOUT_LABEL.has(id)) {
        expect(prompt.includes(`「${label}」`), `${id} prompt mentions ${label}`).toBe(true);
      }

      expect(() => gradeNamedPixel(id, 128, 96, 64)).not.toThrow();
      const buf = new Uint8ClampedArray(data);
      expect(() => gradeLocalRgba(buf, width, height, id)).not.toThrow();

      const changed = buf.some((v, i) => v !== data[i]);
      if (id !== "grayscale" && id !== "invert") {
        expect(changed, `${id} should alter pixels`).toBe(true);
      }
    }
  });
});