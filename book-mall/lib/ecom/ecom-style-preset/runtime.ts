import {
  ECOM_STYLE_PRESET_CATALOG,
  listStylePresetsFromSeed,
  matchesVerticalSeed,
  shuffleWithSeed,
} from "./catalog-seed";
import {
  getStylePresetCatalogVersionFromDb,
  listStylePresetsFromDb,
} from "./db-service";
import { invalidateStylePresetMediaResolveCache } from "./resolve-media";
import type { EcomStylePreset, EcomStylePresetKind, EcomStylePresetVertical } from "./types";
import { ECOM_STYLE_PRESET_CATALOG_VERSION } from "./types";

let cachedById: Map<string, EcomStylePreset> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30_000;

async function loadMergedCache(): Promise<Map<string, EcomStylePreset>> {
  const now = Date.now();
  if (cachedById && now - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedById;
  }

  const map = new Map<string, EcomStylePreset>();
  for (const p of ECOM_STYLE_PRESET_CATALOG) {
    if (p.kind === "trending_visual") map.set(p.id, p);
  }

  try {
    const fromDb = await listStylePresetsFromDb({});
    for (const p of fromDb) {
      map.set(p.id, p);
    }
  } catch (e) {
    console.error("[ecom-style-preset] DB catalog unavailable, using seed fallback", e);
    for (const p of ECOM_STYLE_PRESET_CATALOG) {
      if (p.kind === "sellpoint_layout") map.set(p.id, p);
    }
  }

  cachedById = map;
  cacheLoadedAt = now;
  return map;
}

export function invalidateStylePresetCache(): void {
  cachedById = null;
  cacheLoadedAt = 0;
  invalidateStylePresetMediaResolveCache();
}

export async function ensureStylePresetCache(): Promise<void> {
  await loadMergedCache();
}

export async function getStylePresetByIdLive(id: string): Promise<EcomStylePreset | null> {
  const map = await loadMergedCache();
  return map.get(id.trim()) ?? null;
}

export function getStylePresetById(id: string): EcomStylePreset | null {
  const t = id.trim();
  if (cachedById?.has(t)) return cachedById.get(t)!;
  return ECOM_STYLE_PRESET_CATALOG.find((p) => p.id === t) ?? null;
}

export async function resolveStylePresetsLive(ids: string[]): Promise<EcomStylePreset[]> {
  const map = await loadMergedCache();
  const out: EcomStylePreset[] = [];
  for (const id of ids) {
    const p = map.get(id.trim());
    if (p) out.push(p);
  }
  return out;
}

export function resolveStylePresets(ids: string[]): EcomStylePreset[] {
  const out: EcomStylePreset[] = [];
  for (const id of ids) {
    const p = getStylePresetById(id);
    if (p) out.push(p);
  }
  return out;
}

export async function listStylePresets(opts: {
  kind: EcomStylePresetKind;
  vertical?: EcomStylePresetVertical;
  limit?: number;
  offset?: number;
  seed?: string;
}): Promise<EcomStylePreset[]> {
  const vertical = opts.vertical ?? "generic";
  const map = await loadMergedCache();
  let items = [...map.values()].filter(
    (p) => p.kind === opts.kind && matchesVerticalSeed(p, vertical),
  );
  items.sort((a, b) => a.sortOrder - b.sortOrder);
  if (opts.seed) {
    items = shuffleWithSeed(items, opts.seed);
  }
  const offset = Math.max(0, opts.offset ?? 0);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 50));
  return items.slice(offset, offset + limit);
}

/** 单元测试 / 无 DB 场景：仅读种子 catalog */
export function listStylePresetsSeed(opts: Parameters<typeof listStylePresetsFromSeed>[0]) {
  return listStylePresetsFromSeed(opts);
}

export async function suggestTrendingStylePresets(opts: {
  vertical?: EcomStylePresetVertical;
  limit?: number;
  seed?: string;
}): Promise<EcomStylePreset[]> {
  return listStylePresets({
    kind: "trending_visual",
    vertical: opts.vertical ?? "generic",
    limit: opts.limit ?? 4,
    seed: opts.seed ?? String(Date.now()),
  });
}

export async function resolveCatalogVersionLive(): Promise<string> {
  try {
    const dbVer = await getStylePresetCatalogVersionFromDb();
    return `${ECOM_STYLE_PRESET_CATALOG_VERSION}+${dbVer}`;
  } catch {
    return ECOM_STYLE_PRESET_CATALOG_VERSION;
  }
}
