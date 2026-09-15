/**
 * QuickReplica · 场景模板静态目录。
 */
import { fetchQrPlatform } from "@/lib/qr-platform-fetch";

export type QrTemplateCatalogModel = {
  canonicalModelKey: string;
  displayName: string;
  unit: string;
  creditsPerUnit: number;
  resolved: { modelKey: string; vendor: string; providerKind: string };
};

export type QrTemplateCatalog = {
  version: string;
  templates: Array<{
    id: string;
    status: string;
    models: QrTemplateCatalogModel[];
  }>;
};

let memory: { catalog: QrTemplateCatalog; at: number } | null = null;
const CACHE_MS = 5 * 60 * 1000;

export async function fetchQrModelTemplateCatalog(
  force?: boolean,
): Promise<QrTemplateCatalog | null> {
  if (!force && memory && Date.now() - memory.at < CACHE_MS) return memory.catalog;
  try {
    const res = await fetchQrPlatform(
      "/api/book-mall/api/sso/tools/gateway/model-templates/catalog",
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { catalog?: QrTemplateCatalog };
    if (!data.catalog) return null;
    memory = { catalog: data.catalog, at: Date.now() };
    return data.catalog;
  } catch {
    return null;
  }
}

export function qrModelKeysForTemplate(
  catalog: QrTemplateCatalog | null,
  templateId: string,
): string[] {
  if (!catalog) return [];
  const t = catalog.templates.find((x) => x.id === templateId && x.status === "ACTIVE");
  return (t?.models ?? []).map((m) => m.resolved.modelKey);
}
