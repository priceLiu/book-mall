import { listEcomPropLibraryEntries } from "./ecom-prop-library/catalog";
import type { EcomPropLibraryCatalog } from "./ecom-prop-library/types";

export async function fetchEcomPropLibraryCatalog(): Promise<EcomPropLibraryCatalog> {
  try {
    const res = await fetch("/api/book-mall/api/sso/tools/ecom/prop-library/catalog", {
      credentials: "include",
    });
    if (res.ok) {
      return (await res.json()) as EcomPropLibraryCatalog;
    }
  } catch {
    /* fallback */
  }
  return { props: listEcomPropLibraryEntries() };
}
