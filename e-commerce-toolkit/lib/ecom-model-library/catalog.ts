import type { EcomModelLibraryCatalog } from "./types";
import catalogData from "./catalog.json";

export const ECOM_MODEL_LIBRARY_CATALOG = catalogData as EcomModelLibraryCatalog;

export function listEcomModelLibraryEntries() {
  return ECOM_MODEL_LIBRARY_CATALOG.models;
}
