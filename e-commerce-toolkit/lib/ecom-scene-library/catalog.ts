import catalog from "./catalog.json";
import type { EcomSceneLibraryCatalog, EcomSceneLibraryEntry } from "./types";

export function listEcomSceneLibraryEntries(): EcomSceneLibraryEntry[] {
  return (catalog as EcomSceneLibraryCatalog).scenes ?? [];
}
