import catalog from "./catalog.json";
import type { EcomPropLibraryCatalog, EcomPropLibraryEntry } from "./types";

export function listEcomPropLibraryEntries(): EcomPropLibraryEntry[] {
  return (catalog as EcomPropLibraryCatalog).props ?? [];
}
