/**
 * 场景模板静态目录 · 经 canvas BFF / SSO（与 credits-preview 同鉴权）。
 */
import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

export type TemplateCatalogModel = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  tiers: Array<{ tierRaw: string; creditsPerUnit: number }>;
  rules: Record<string, unknown>;
  resolved: {
    modelKey: string;
    vendor: string;
    providerKind: string;
  };
};

export type TemplateCatalog = {
  version: string;
  publishedAt: string;
  templates: Array<{
    id: string;
    title: string;
    status: string;
    rules: Record<string, unknown>;
    models: TemplateCatalogModel[];
  }>;
};

let memory: { catalog: TemplateCatalog; at: number; base: string } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export function estimateCreditsFromCatalogModel(
  model: TemplateCatalogModel,
  units: number,
  tierRaw?: string,
): number {
  const u = Math.max(0, Number(units) || 0);
  if (tierRaw?.trim()) {
    const tier = model.tiers.find(
      (t) => t.tierRaw.toUpperCase() === tierRaw.trim().toUpperCase(),
    );
    if (tier) return Math.round(tier.creditsPerUnit * u * 100) / 100;
  }
  return Math.round(model.creditsPerUnit * u * 100) / 100;
}

export async function fetchModelTemplateCatalog(
  base: string,
  opts?: { version?: string; force?: boolean },
): Promise<TemplateCatalog | null> {
  const b = base.replace(/\/$/, "");
  if (
    !opts?.force &&
    memory &&
    memory.base === b &&
    Date.now() - memory.at < CACHE_MS &&
    (!opts?.version || memory.catalog.version === opts.version)
  ) {
    return memory.catalog;
  }

  const q = opts?.version ? `?version=${encodeURIComponent(opts.version)}` : "";
  const { url, init } = resolveBookMallBrowserRequest(
    b,
    `/api/sso/tools/gateway/model-templates/catalog${q}`,
    { credentials: "same-origin", cache: "no-store" },
  );

  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; catalog?: TemplateCatalog };
    if (!data.catalog) return null;
    memory = { catalog: data.catalog, at: Date.now(), base: b };
    return data.catalog;
  } catch {
    return null;
  }
}

export function modelsForTemplate(
  catalog: TemplateCatalog | null,
  templateId: string,
): TemplateCatalogModel[] {
  if (!catalog) return [];
  const t = catalog.templates.find((x) => x.id === templateId && x.status === "ACTIVE");
  return t?.models ?? [];
}

export function findCatalogModelByModelKey(
  catalog: TemplateCatalog | null,
  modelKey: string,
): TemplateCatalogModel | null {
  if (!catalog || !modelKey.trim()) return null;
  const k = modelKey.trim();
  for (const t of catalog.templates) {
    for (const m of t.models) {
      if (m.resolved.modelKey === k || m.canonicalModelKey === k) return m;
    }
  }
  return null;
}

/** 按模板取可调用 modelKey 列表（供 EnginePicker allowedModelKeys） */
export function modelKeysForTemplate(
  catalog: TemplateCatalog | null,
  templateId: string,
): string[] {
  return modelsForTemplate(catalog, templateId).map((m) => m.resolved.modelKey);
}
