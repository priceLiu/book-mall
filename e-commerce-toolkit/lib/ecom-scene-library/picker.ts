import type { CatalogPickerEntry } from "@/components/model-shot/ecom-catalog-picker-dialog";

import {
  resolveSceneLibraryCardImageUrl,
  sceneLibraryEntryHasOwnImage,
} from "./display";
import type { EcomSceneLibraryEntry } from "./types";

export function sceneToCatalogPickerEntry(entry: EcomSceneLibraryEntry): CatalogPickerEntry {
  const own = sceneLibraryEntryHasOwnImage(entry)
    ? entry.thumbUrl?.trim() || entry.ossUrl?.trim()
    : undefined;
  return {
    id: entry.id,
    name: entry.name,
    subtitle: entry.visualPrompt,
    previewImageUrl: resolveSceneLibraryCardImageUrl(entry),
    imageUrl: own,
    scope: entry.scope,
    lockedAt: entry.lockedAt,
  };
}
