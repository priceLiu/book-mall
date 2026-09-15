/**
 * Story · 场景模板静态目录（经 book-mall BFF / SSO）。
 */
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type TemplateCatalogModel = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  resolved: { modelKey: string; vendor: string; providerKind: string };
};

export type TemplateCatalog = {
  version: string;
  publishedAt: string;
  templates: Array<{
    id: string;
    status: string;
    models: TemplateCatalogModel[];
  }>;
};

let memory: { catalog: TemplateCatalog; at: number; base: string } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchStoryModelTemplateCatalog(
  base: string,
  force?: boolean,
): Promise<TemplateCatalog | null> {
  const b = base.replace(/\/$/, "");
  if (!force && memory && memory.base === b && Date.now() - memory.at < CACHE_MS) {
    return memory.catalog;
  }
  try {
    const { url, init } = resolveBookMallBrowserRequest(
      b,
      "/api/sso/tools/gateway/model-templates/catalog",
      { credentials: "same-origin", cache: "no-store" },
    );
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const data = (await res.json()) as { catalog?: TemplateCatalog };
    if (!data.catalog) return null;
    memory = { catalog: data.catalog, at: Date.now(), base: b };
    return data.catalog;
  } catch {
    return null;
  }
}

export function storyModelKeysForTemplates(
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

/** Story role → 场景模板 */
export function storyRoleToTemplateIds(role: string): string[] {
  switch (role.toUpperCase()) {
    case "LLM":
      return ["text"];
    case "IMAGE":
      return ["t2i", "i2i"];
    case "VIDEO":
      return ["i2v", "t2v", "v2v"];
    default:
      return [];
  }
}

export function filterByTemplateKeys<T extends { modelKey?: string; id?: string }>(
  rows: T[],
  allowed: Set<string>,
): T[] {
  if (allowed.size === 0) return rows;
  const filtered = rows.filter((r) => {
    const k = (r.modelKey ?? r.id ?? "").toLowerCase();
    return k && allowed.has(k);
  });
  return filtered.length > 0 ? filtered : rows;
}
