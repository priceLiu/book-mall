/**
 * tool-web · 场景模板静态目录（经本站 BFF → book-mall）。
 */
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

export async function fetchToolModelTemplateCatalog(
  force?: boolean,
): Promise<TemplateCatalog | null> {
  if (!force && memory && Date.now() - memory.at < CACHE_MS) return memory.catalog;
  try {
    const res = await fetch("/api/model-templates-catalog", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { catalog?: TemplateCatalog };
    if (!data.catalog) return null;
    memory = { catalog: data.catalog, at: Date.now() };
    return data.catalog;
  } catch {
    return null;
  }
}

export function toolModelKeysForTemplates(
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

/** lab modeTab → 场景模板 */
export function toolLabModeToTemplateIds(modeTab: string): string[] {
  if (modeTab === "t2v") return ["t2v"];
  if (modeTab === "ref") return ["i2v", "v2v"];
  return ["i2v", "t2v"];
}
