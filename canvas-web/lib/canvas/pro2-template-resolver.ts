/**
 * Pro2 模板运行时解析 · DB 优先，TS 金标准 fallback
 * book-mall/lib/canvas/pro2-template-resolver.ts 须保持同步
 */
import { fetchActivePro2Templates } from "@/lib/canvas-api";
import {
  PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
  PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
  PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
} from "@/lib/canvas/data/pro2-production-pack-standard";
import type {
  Pro2ActiveTemplatesSnapshot,
  Pro2HubPromptPackResolved,
  Pro2PromptTemplatePassKind,
} from "@/lib/canvas/pro2-prompt-template-types";
import {
  renderPro2AssetDockPromptFromBlocks,
  resolvePro2AssetCompositionFromBlocks,
} from "@/lib/canvas/pro2-prompt-template-types";
import {
  storyPro2GuFengHubPromptPack,
  storyPro2HubDefaultPromptPack,
} from "@/lib/canvas/story-pro2-theme-outline-prompt";
import type { Pro2ScriptCategoryId } from "@/lib/canvas/pro2-script-category-presets";

const CACHE_TTL_MS = 60_000;

type CacheEntry = {
  expiresAt: number;
  snapshot: Pro2ActiveTemplatesSnapshot;
  packs: Map<string, Pro2HubPromptPackResolved | null>;
};

let cacheByBase = new Map<string, CacheEntry>();
let hubPackSyncCache = new Map<string, Pro2HubPromptPackResolved>();
let assetCompositionSyncCache = new Map<
  Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
  string
>();

export function clearPro2TemplateResolverCache(base?: string): void {
  if (base) cacheByBase.delete(base.replace(/\/$/, ""));
  else {
    cacheByBase.clear();
    hubPackSyncCache.clear();
    assetCompositionSyncCache.clear();
  }
}

/** 画布页 / Hub 初始化时预热模板缓存 */
export async function warmPro2TemplateCache(base: string): Promise<void> {
  const key = base.replace(/\/$/, "");
  const entry = await loadCache(key);
  for (const [packKey, pack] of entry.packs.entries()) {
    if (pack) hubPackSyncCache.set(packKey, pack);
  }
  for (const tpl of entry.snapshot.assetTemplates) {
    if (
      tpl.passKind === "CHARACTER_FOUR_VIEW" ||
      tpl.passKind === "SCENE_FOUR_PANORAMA" ||
      tpl.passKind === "PROP_SIX_VIEW"
    ) {
      const spec = resolvePro2AssetCompositionFromBlocks(tpl.blocks);
      if (spec) assetCompositionSyncCache.set(tpl.passKind, spec);
    }
  }
}

export function getPro2HubPromptPackFromSyncCache(
  hubData?: {
    scriptCategoryId?: Pro2ScriptCategoryId;
    templatePackKey?: string;
  },
): Pro2HubPromptPackResolved | undefined {
  const packKey =
    hubData?.templatePackKey?.trim() ||
    (hubData?.scriptCategoryId === "gu-feng-tian-chong"
      ? "gu-feng-tian-chong"
      : "default-master");
  return hubPackSyncCache.get(packKey);
}

export function getActiveAssetCompositionSpecSync(
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
): string {
  return assetCompositionSyncCache.get(passKind) ?? ASSET_FALLBACK[passKind];
}

async function loadCache(base: string): Promise<CacheEntry> {
  const key = base.replace(/\/$/, "");
  const now = Date.now();
  const hit = cacheByBase.get(key);
  if (hit && hit.expiresAt > now) return hit;

  const { snapshot, pack } = await fetchActivePro2Templates(key);
  const packs = new Map<string, Pro2HubPromptPackResolved | null>();
  if (pack) packs.set(pack.packKey, pack);
  for (const p of snapshot.packs) {
    if (!packs.has(p.packKey)) {
      const resolved = await fetchActivePro2Templates(key, p.packKey);
      packs.set(p.packKey, resolved.pack);
    }
  }
  const entry: CacheEntry = {
    expiresAt: now + CACHE_TTL_MS,
    snapshot,
    packs,
  };
  cacheByBase.set(key, entry);
  return entry;
}

function fallbackHubPack(categoryId?: Pro2ScriptCategoryId): Pro2HubPromptPackResolved {
  const pack =
    categoryId === "gu-feng-tian-chong"
      ? storyPro2GuFengHubPromptPack()
      : storyPro2HubDefaultPromptPack();
  return {
    packKey: categoryId === "gu-feng-tian-chong" ? "gu-feng-tian-chong" : "default-master",
    ...pack,
  };
}

export async function resolvePro2HubPromptPackFromDb(
  base: string | undefined,
  hubData?: {
    scriptCategoryId?: Pro2ScriptCategoryId;
    templatePackKey?: string;
  },
): Promise<Pro2HubPromptPackResolved> {
  const packKey =
    hubData?.templatePackKey?.trim() ||
    (hubData?.scriptCategoryId === "gu-feng-tian-chong"
      ? "gu-feng-tian-chong"
      : "default-master");

  if (!base?.trim()) return fallbackHubPack(hubData?.scriptCategoryId);

  try {
    const cache = await loadCache(base);
    const resolved = cache.packs.get(packKey);
    if (resolved) return resolved;
    const { pack } = await fetchActivePro2Templates(base, packKey);
    if (pack) {
      cache.packs.set(packKey, pack);
      return pack;
    }
  } catch {
    /* fallback below */
  }
  return fallbackHubPack(hubData?.scriptCategoryId);
}

const ASSET_FALLBACK: Record<
  Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
  string
> = {
  CHARACTER_FOUR_VIEW: PRO2_CHARACTER_FOUR_VIEW_COMPOSITION_SPEC,
  SCENE_FOUR_PANORAMA: PRO2_SCENE_FOUR_VIEW_COMPOSITION_SPEC,
  PROP_SIX_VIEW: PRO2_PROP_SIX_VIEW_COMPOSITION_SPEC,
};

export async function resolvePro2AssetCompositionSpecFromDb(
  base: string | undefined,
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
): Promise<string> {
  if (base?.trim()) {
    try {
      const cache = await loadCache(base);
      const tpl = cache.snapshot.assetTemplates.find((t) => t.passKind === passKind);
      const spec = tpl ? resolvePro2AssetCompositionFromBlocks(tpl.blocks) : undefined;
      if (spec) return spec;
    } catch {
      /* fallback */
    }
  }
  return ASSET_FALLBACK[passKind];
}

export async function renderPro2AssetDockPromptFromDb(
  base: string | undefined,
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
  slots: Record<string, string>,
  visualStyleTag?: string,
): Promise<string> {
  if (base?.trim()) {
    try {
      const cache = await loadCache(base);
      const tpl = cache.snapshot.assetTemplates.find((t) => t.passKind === passKind);
      if (tpl) {
        return renderPro2AssetDockPromptFromBlocks(tpl.blocks, slots, visualStyleTag);
      }
    } catch {
      /* fallback */
    }
  }
  const spec = ASSET_FALLBACK[passKind];
  const lines = Object.entries(slots)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => {
      const labels: Record<string, string> = {
        name: "名称",
        description: "描述",
        clothing: "服装",
        traits: "特征",
        foreground: "前背景",
        atmosphere: "氛围",
      };
      return `${labels[k] ?? k}：${v.trim()}`;
    });
  lines.push(`构图规范：${spec}`);
  if (visualStyleTag?.trim()) lines.push(visualStyleTag.trim());
  return lines.join("\n\n").trim();
}

/** 同步 fallback · 无 base 或未 seed DB 时使用 */
export function resolvePro2AssetCompositionSpecSync(
  passKind: Extract<
    Pro2PromptTemplatePassKind,
    "CHARACTER_FOUR_VIEW" | "SCENE_FOUR_PANORAMA" | "PROP_SIX_VIEW"
  >,
): string {
  return ASSET_FALLBACK[passKind];
}
