import { shuffleByIdForDisplay } from "@/lib/ecom-random-order";
import type { EcomModelLibraryEntry } from "@/lib/ecom-model-library/types";

export function isPlusFemaleModel(model: EcomModelLibraryEntry): boolean {
  return model.gender === "plus_female";
}

/** 大码女沉底，组内随机；seed=0 保持原始顺序 */
export function sortModelLibraryForDisplay(
  models: EcomModelLibraryEntry[],
  seed: number,
): EcomModelLibraryEntry[] {
  return shuffleByIdForDisplay(models, seed, isPlusFemaleModel);
}
