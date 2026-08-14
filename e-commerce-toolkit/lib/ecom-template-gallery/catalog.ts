import type { EcomTemplateGalleryCatalog } from "./types";
import catalogData from "./catalog.json";

/** build 时 bundled 的静态快照（API 不可用时的 fallback） */
export const ECOM_TEMPLATE_GALLERY_STATIC_CATALOG =
  catalogData as EcomTemplateGalleryCatalog;

export function listEcomTemplateGalleryEntriesStatic() {
  return ECOM_TEMPLATE_GALLERY_STATIC_CATALOG.templates;
}

export function mergeTemplateGalleryEntries(
  base: EcomTemplateGalleryCatalog["templates"],
  incoming: EcomTemplateGalleryCatalog["templates"],
): EcomTemplateGalleryCatalog["templates"] {
  const byId = new Map(base.map((t) => [t.id, t]));
  for (const t of incoming) {
    byId.set(t.id, t);
  }
  return Array.from(byId.values());
}
