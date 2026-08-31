import { listEcomPoseLibraryEntries } from "./ecom-pose-library/catalog";
import type { EcomPoseLibraryCatalog } from "./ecom-pose-library/types";

export async function fetchEcomPoseLibraryCatalog(): Promise<EcomPoseLibraryCatalog> {
  try {
    const res = await fetch("/api/book-mall/api/sso/tools/ecom/pose-library/catalog", {
      credentials: "include",
    });
    if (res.ok) {
      return (await res.json()) as EcomPoseLibraryCatalog;
    }
  } catch {
    /* fallback */
  }
  return { poses: listEcomPoseLibraryEntries() };
}
