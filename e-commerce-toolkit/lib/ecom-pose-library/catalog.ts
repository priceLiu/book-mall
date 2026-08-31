import catalog from "./catalog.json";
import type { EcomPoseLibraryCatalog, EcomPoseLibraryEntry } from "./types";

export function listEcomPoseLibraryEntries(): EcomPoseLibraryEntry[] {
  return (catalog as EcomPoseLibraryCatalog).poses ?? [];
}
