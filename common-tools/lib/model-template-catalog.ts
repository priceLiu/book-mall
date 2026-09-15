/**
 * 常用工具 · 场景模板静态目录（经 /api/book-mall BFF）。
 */
import { bookFetch } from "@/lib/book-fetch";

export type TemplateCatalogModel = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  resolved: { modelKey: string; vendor: string; providerKind: string };
};

export type TemplateCatalog = {
  version: string;
  templates: Array<{
    id: string;
    status: string;
    models: TemplateCatalogModel[];
  }>;
};

let memory: { catalog: TemplateCatalog; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchCommonToolsModelTemplateCatalog(
  force?: boolean,
): Promise<TemplateCatalog | null> {
  if (!force && memory && Date.now() - memory.at < CACHE_MS) return memory.catalog;
  try {
    const data = (await bookFetch(
      "api/sso/tools/gateway/model-templates/catalog",
    )) as { catalog?: TemplateCatalog };
    if (!data.catalog) return null;
    memory = { catalog: data.catalog, at: Date.now() };
    return data.catalog;
  } catch {
    return null;
  }
}

export function commonToolsModelKeysForTemplates(
  catalog: TemplateCatalog | null,
  templateIds: string[],
): Set<string> {
  const set = new Set<string>();
  if (!catalog) return set;
  for (const id of templateIds) {
    const t = catalog.templates.find((x) => x.id === id && x.status === "ACTIVE");
    for (const m of t?.models ?? []) {
      set.add(m.resolved.modelKey.toLowerCase());
      set.add(m.canonicalModelKey.toLowerCase());
    }
  }
  return set;
}

export function filterOptionsByTemplateKeys<T extends { id: string }>(
  options: readonly T[],
  allowed: Set<string>,
): T[] {
  if (allowed.size === 0) return [...options];
  const filtered = options.filter((o) => allowed.has(o.id.toLowerCase()));
  return filtered.length > 0 ? filtered : [...options];
}

export function filterModelsByTemplateKeys<T extends { modelKey: string }>(
  models: T[],
  allowed: Set<string>,
): T[] {
  if (allowed.size === 0) return models;
  const filtered = models.filter((m) => allowed.has(m.modelKey.toLowerCase()));
  return filtered.length > 0 ? filtered : models;
}
