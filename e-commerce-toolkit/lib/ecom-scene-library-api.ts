import { listEcomSceneLibraryEntries } from "./ecom-scene-library/catalog";
import type { EcomSceneLibraryCatalog } from "./ecom-scene-library/types";

export async function fetchEcomSceneLibraryCatalog(): Promise<EcomSceneLibraryCatalog> {
  try {
    const res = await fetch("/api/book-mall/api/sso/tools/ecom/scene-library/catalog", {
      credentials: "include",
    });
    if (res.ok) {
      return (await res.json()) as EcomSceneLibraryCatalog;
    }
  } catch {
    /* fallback */
  }
  return { scenes: listEcomSceneLibraryEntries() };
}
