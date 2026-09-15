/**
 * 电商 · 场景模板静态目录（经 /api/book-mall BFF）。
 */
import { ecomBookFetch } from "@/lib/ecom-book-fetch";

export type EcomTemplateCatalogModel = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  resolved: { modelKey: string; vendor: string; providerKind: string };
};

export type EcomTemplateCatalog = {
  version: string;
  templates: Array<{
    id: string;
    status: string;
    models: EcomTemplateCatalogModel[];
  }>;
};

let memory: { catalog: EcomTemplateCatalog; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchEcomModelTemplateCatalog(
  force?: boolean,
): Promise<EcomTemplateCatalog | null> {
  if (!force && memory && Date.now() - memory.at < CACHE_MS) return memory.catalog;
  try {
    const data = (await ecomBookFetch(
      "api/sso/tools/gateway/model-templates/catalog",
      { cache: "no-store" },
    )) as { catalog?: EcomTemplateCatalog };
    if (!data.catalog) return null;
    memory = { catalog: data.catalog, at: Date.now() };
    return data.catalog;
  } catch {
    return null;
  }
}

export function ecomModelKeysForTemplate(
  catalog: EcomTemplateCatalog | null,
  templateId: string,
): string[] {
  if (!catalog) return [];
  const t = catalog.templates.find((x) => x.id === templateId && x.status === "ACTIVE");
  return (t?.models ?? []).map((m) => m.resolved.modelKey);
}

export function ecomEstimateCredits(
  catalog: EcomTemplateCatalog | null,
  modelKey: string,
  units: number,
): number | null {
  if (!catalog) return null;
  for (const t of catalog.templates) {
    for (const m of t.models) {
      if (m.resolved.modelKey === modelKey || m.canonicalModelKey === modelKey) {
        return Math.round(m.creditsPerUnit * Math.max(0, units) * 100) / 100;
      }
    }
  }
  return null;
}
