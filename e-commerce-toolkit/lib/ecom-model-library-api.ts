"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import { listEcomModelLibraryEntries } from "@/lib/ecom-model-library/catalog";
import type { EcomModelLibraryCatalog } from "@/lib/ecom-model-library/types";

const CATALOG_PATH = "api/sso/tools/ecom/model-library/catalog";

export async function fetchEcomModelLibraryCatalog(): Promise<EcomModelLibraryCatalog> {
  try {
    const data = await ecomBookFetch(CATALOG_PATH);
    const catalog = data as EcomModelLibraryCatalog;
    if (Array.isArray(catalog.models) && catalog.models.length > 0) return catalog;
  } catch {
    /* fallback static */
  }
  return { models: listEcomModelLibraryEntries() };
}
