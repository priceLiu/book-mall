import type { EcomModelAge, EcomModelGender, EcomModelLibraryEntry } from "@/lib/ecom-model-library/types";

export type ModelLibraryGenderFilter = "all" | EcomModelGender;
export type ModelLibraryAgeFilter = "all" | EcomModelAge;

export function filterModelLibraryEntries(
  models: EcomModelLibraryEntry[],
  gender: ModelLibraryGenderFilter,
  age: ModelLibraryAgeFilter = "all",
): EcomModelLibraryEntry[] {
  return models.filter((m) => {
    if (gender !== "all" && m.gender !== gender) return false;
    if (age !== "all" && m.age !== age) return false;
    return true;
  });
}
