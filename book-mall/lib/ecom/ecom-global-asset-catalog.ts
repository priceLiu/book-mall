/**
 * 全局资产库 · 平台素材 catalog 聚合
 */

import type { EcomCatalogScope } from "@/lib/ecom/ecom-catalog-scope";
import { listAvatarLibraryEntriesForViewer } from "@/lib/ecom/ecom-model-library-service";
import { listGarmentLibraryEntriesForViewer } from "@/lib/ecom/ecom-garment-library-service";
import { listFullBodyModelsForViewer } from "@/lib/ecom/ecom-full-body-model-library-service";
import { readPoseLibraryCatalogForUser } from "@/lib/ecom/ecom-pose-library-service";
import { sceneLibraryEntryHasOwnImage } from "@/lib/ecom/ecom-scene-library-display";
import {
  listSceneLibraryEntriesForViewer,
  readSceneLibraryCatalogForUser,
  readSceneLibraryCatalogLive,
  type EcomSceneLibraryEntry,
} from "@/lib/ecom/ecom-scene-library-service";
import {
  readPropLibraryCatalogForUser,
  readPropLibraryCatalogLive,
  type EcomPropLibraryEntry,
} from "@/lib/ecom/ecom-prop-library-service";
import { listStyleLibraryEntriesForViewer } from "@/lib/ecom/ecom-style-library-service";
import { buildCatalogViewerScopeOr } from "@/lib/ecom/ecom-catalog-viewer-scope";
import { prisma } from "@/lib/prisma";

export type GlobalAssetCatalogKind =
  | "pose"
  | "avatar"
  | "garment"
  | "full-body"
  | "style"
  | "scene"
  | "character"
  | "reference"
  | "prop"
  | "storyboard-image"
  | "storyboard-video"
  | "audio";

export type GlobalAssetCatalogItem = {
  id: string;
  catalogKind: GlobalAssetCatalogKind;
  title: string;
  ossUrl: string;
  thumbUrl: string | null;
  scope: EcomCatalogScope;
  gender?: string | null;
  subtitle?: string | null;
  description?: string | null;
  promptOnly?: boolean;
};

/** 姿势库 · 无参考图时的默认占位 */
export const GLOBAL_ASSET_POSE_PLACEHOLDER =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#ebebed"/><text x="60" y="56" text-anchor="middle" fill="#86868b" font-size="11" font-family="sans-serif">姿势</text><text x="60" y="74" text-anchor="middle" fill="#aeaeb2" font-size="9" font-family="sans-serif">提示词</text></svg>',
  );

export type GlobalAssetCatalogQuery = {
  userId: string;
  tenantId?: string | null;
  /** 画布当前项目 · 用于 project 范围 catalog 可见性 */
  projectId?: string | null;
  kind?: GlobalAssetCatalogKind | "all";
  gender?: string | null;
  keyword?: string | null;
  limit?: number;
  /** 画布平台资产库 / 纯平台选用：不含 user·team 个人 catalog */
  platformOnly?: boolean;
  /** 我的共用：仅 user / team / project，不含 platform */
  sharedOnly?: boolean;
  /** 分页偏移（单 kind 请求） */
  offset?: number;
  /** 仅返回当前 kind 条数，不拉全站 counts（默认单 kind 即 none） */
  countsScope?: "none" | "all";
  /** limit=0 时并行统计这些 kind 条数（模特·素材 Hub 三级 Tab） */
  countsKinds?: GlobalAssetCatalogKind[];
  /** 姿势库：提示词 / 参考图 */
  mediaFilter?: "all" | "prompt" | "image";
  /** 姿势库 · category（subtitle） */
  poseCategory?: string | null;
};

function matchesKeyword(item: GlobalAssetCatalogItem, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    (item.subtitle?.toLowerCase().includes(q) ?? false) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

function isPlusFemaleAvatar(item: GlobalAssetCatalogItem): boolean {
  return (
    item.gender === "plus_female" ||
    item.title.includes("大码") ||
    item.title.includes("大龄")
  );
}

function sortAvatarCatalogItems(items: GlobalAssetCatalogItem[]): GlobalAssetCatalogItem[] {
  return [...items].sort((a, b) => {
    const aPlus = isPlusFemaleAvatar(a) ? 1 : 0;
    const bPlus = isPlusFemaleAvatar(b) ? 1 : 0;
    if (aPlus !== bPlus) return aPlus - bPlus;
    return a.title.localeCompare(b.title, "zh-CN");
  });
}

function scopeLabel(scope: EcomCatalogScope): string {
  if (scope === "platform") return "平台";
  if (scope === "team") return "团队";
  if (scope === "project") return "本项目";
  return "我的";
}

export function globalAssetCatalogItemScopeLabel(item: GlobalAssetCatalogItem): string {
  return scopeLabel(item.scope);
}

const ALL_KINDS: GlobalAssetCatalogKind[] = [
  "character",
  "prop",
  "scene",
  "style",
  "reference",
  "storyboard-image",
  "pose",
  "avatar",
  "full-body",
  "garment",
];

function matchesGender(item: GlobalAssetCatalogItem, gender: string): boolean {
  if (!item.gender) return true;
  if (item.gender === "unisex") return true;
  if (gender === "female" && item.gender === "plus_female") return true;
  return item.gender === gender;
}

async function loadPoseItems(userId: string): Promise<GlobalAssetCatalogItem[]> {
  const poseCat = await readPoseLibraryCatalogForUser(userId);
  const poses = [...(poseCat.platform ?? []), ...(poseCat.user ?? [])];
  const items: GlobalAssetCatalogItem[] = [];
  for (const p of poses) {
    const hasImage = Boolean(p.ossUrl?.trim());
    items.push({
      id: p.id,
      catalogKind: "pose",
      title: p.title,
      ossUrl: hasImage ? p.ossUrl!.trim() : GLOBAL_ASSET_POSE_PLACEHOLDER,
      thumbUrl: hasImage ? (p.thumbUrl ?? p.ossUrl!) : GLOBAL_ASSET_POSE_PLACEHOLDER,
      scope: (p.scope ?? "platform") as EcomCatalogScope,
      gender: p.genders?.[0] ?? null,
      subtitle: p.category,
      description: p.baseDescription || p.title,
      promptOnly: !hasImage,
    });
  }
  return items;
}

function isCharacterModelId(id: string): boolean {
  return id.startsWith("character-") || id.startsWith("user-character-");
}

async function loadAvatarItems(
  query: GlobalAssetCatalogQuery,
): Promise<GlobalAssetCatalogItem[]> {
  const models = await listAvatarLibraryEntriesForViewer({
    userId: query.userId,
    tenantId: query.tenantId,
    gender: query.gender,
  });
  return sortAvatarCatalogItems(
    models.map((m) => ({
        id: m.id,
        catalogKind: "avatar" as const,
        title: m.name,
        ossUrl: m.ossUrl,
        thumbUrl: m.thumbUrl ?? m.ossUrl,
        scope: (m.scope ?? "platform") as EcomCatalogScope,
        gender: m.gender,
        subtitle: m.age,
      })),
  );
}

async function loadCharacterItems(
  query: GlobalAssetCatalogQuery,
): Promise<GlobalAssetCatalogItem[]> {
  const models = await listAvatarLibraryEntriesForViewer({
    userId: query.userId,
    tenantId: query.tenantId,
    gender: query.gender,
  });
  return models
    .filter((m) => isCharacterModelId(m.id))
    .map((m) => ({
      id: m.id,
      catalogKind: "character" as const,
      title: m.name,
      ossUrl: m.ossUrl,
      thumbUrl: m.thumbUrl ?? m.ossUrl,
      scope: (m.scope ?? "platform") as EcomCatalogScope,
      gender: m.gender,
      subtitle: m.age,
    }));
}

function garmentKindToCatalogKind(garmentKind: string | undefined): GlobalAssetCatalogKind {
  const k = garmentKind?.trim() || "flat";
  if (k === "reference") return "reference";
  if (k === "prop") return "prop";
  if (k === "storyboard-image") return "storyboard-image";
  if (k === "storyboard-video") return "storyboard-video";
  return "garment";
}

async function loadGarmentItems(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<GlobalAssetCatalogItem[]> {
  const garments = await listGarmentLibraryEntriesForViewer({
    userId: query.userId,
    tenantId: query.tenantId,
    projectId: query.projectId,
    limit,
  });
  return garments
    .filter((g) => garmentKindToCatalogKind(g.garmentKind) === "garment")
    .map((g) => ({
      id: g.id,
      catalogKind: "garment" as const,
      title: g.name,
      ossUrl: g.ossUrl,
      thumbUrl: g.thumbUrl ?? g.ossUrl,
      scope: (g.scope ?? "platform") as EcomCatalogScope,
      gender: g.gender,
      subtitle: g.garmentKind,
    }));
}

async function loadGarmentBackedCatalogItems(
  query: GlobalAssetCatalogQuery,
  limit: number,
  targetCatalogKind: GlobalAssetCatalogKind,
  garmentKind: string,
): Promise<GlobalAssetCatalogItem[]> {
  const garments = await listGarmentLibraryEntriesForViewer({
    userId: query.userId,
    tenantId: query.tenantId,
    projectId: query.projectId,
    limit,
  });
  return garments
    .filter((g) => (g.garmentKind?.trim() || "flat") === garmentKind)
    .map((g) => ({
      id: g.id,
      catalogKind: targetCatalogKind,
      title: g.name,
      ossUrl: g.ossUrl,
      thumbUrl: g.thumbUrl ?? g.ossUrl,
      scope: (g.scope ?? "platform") as EcomCatalogScope,
      gender: g.gender,
      subtitle: g.garmentKind,
    }));
}

async function loadFullBodyItems(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<GlobalAssetCatalogItem[]> {
  const scopeOr = buildCatalogViewerScopeOr({
    userId: query.userId,
    tenantId: query.tenantId,
    projectId: query.projectId,
  });
  const items: GlobalAssetCatalogItem[] = [];

  const bodies = await listFullBodyModelsForViewer({
    userId: query.userId,
    tenantId: query.tenantId,
    projectId: query.projectId,
    limit: 240,
  });
  for (const b of bodies) {
    items.push({
      id: b.id,
      catalogKind: "full-body",
      title: b.name,
      ossUrl: b.ossUrl,
      thumbUrl: b.thumbUrl ?? b.ossUrl,
      scope: (b.scope ?? "user") as EcomCatalogScope,
      gender: b.gender,
    });
  }

  const fullBodyAvatars = await prisma.ecomModelLibraryEntry.findMany({
    where: {
      deletedAt: null,
      enabled: true,
      AND: [
        { OR: scopeOr },
        {
          OR: [
            { name: { contains: "全身" } },
            { name: { contains: "full-body", mode: "insensitive" } },
          ],
        },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    take: 240,
  });
  for (const m of fullBodyAvatars) {
    if (items.some((i) => i.id === m.id || i.ossUrl === m.ossUrl)) continue;
    items.push({
      id: m.id,
      catalogKind: "full-body",
      title: m.name,
      ossUrl: m.ossUrl,
      thumbUrl: m.thumbUrl ?? m.ossUrl,
      scope: (m.scope === "user" || m.scope === "team" || m.scope === "project"
        ? m.scope
        : "platform") as EcomCatalogScope,
      gender: m.gender,
    });
  }

  const tryonAssets = await prisma.ecomAsset.findMany({
    where: {
      userId: query.userId,
      module: "model-tryon-model",
      kind: "image",
    },
    orderBy: { createdAt: "desc" },
    take: 240,
  });
  for (const asset of tryonAssets) {
    if (!asset.ossUrl?.trim()) continue;
    if (items.some((i) => i.ossUrl === asset.ossUrl)) continue;
    items.push({
      id: `tryon-asset-${asset.id}`,
      catalogKind: "full-body",
      title: asset.title?.trim() || "全身模特",
      ossUrl: asset.ossUrl,
      thumbUrl: asset.thumbnailUrl ?? asset.ossUrl,
      scope: "user",
      gender: null,
      description: asset.prompt,
    });
  }

  return items.slice(0, limit);
}

async function loadStyleItems(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<GlobalAssetCatalogItem[]> {
  const styles = await listStyleLibraryEntriesForViewer({
    userId: query.userId,
    tenantId: query.tenantId,
    projectId: query.projectId,
    limit,
  });
  return styles
    .filter((s) => s.ossUrl?.trim())
    .map((s) => ({
      id: s.id,
      catalogKind: "style" as const,
      title: s.name,
      ossUrl: s.ossUrl!.trim(),
      thumbUrl: s.thumbUrl ?? s.ossUrl ?? null,
      scope: (s.scope ?? "user") as EcomCatalogScope,
      description: s.stylePrompt,
    }));
}

function sceneEntryToCatalogItem(s: EcomSceneLibraryEntry): GlobalAssetCatalogItem {
  const hasOwn = sceneLibraryEntryHasOwnImage(s);
  return {
    id: s.id,
    catalogKind: "scene",
    title: s.name,
    ossUrl: hasOwn ? (s.thumbUrl?.trim() || s.ossUrl!.trim()) : "",
    thumbUrl: hasOwn ? (s.thumbUrl ?? s.ossUrl ?? null) : null,
    scope: (s.scope ?? "user") as EcomCatalogScope,
    description: s.visualPrompt,
    promptOnly: !hasOwn,
  };
}

function propEntryToCatalogItem(p: EcomPropLibraryEntry): GlobalAssetCatalogItem {
  const hasImage = Boolean(p.ossUrl?.trim());
  return {
    id: p.id,
    catalogKind: "prop",
    title: p.name,
    ossUrl: hasImage ? p.ossUrl!.trim() : "",
    thumbUrl: hasImage ? p.ossUrl ?? null : null,
    scope: (p.scope ?? "platform") as EcomCatalogScope,
    description: p.visualDescription,
    promptOnly: !hasImage,
  };
}

async function loadPropItems(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<GlobalAssetCatalogItem[]> {
  const merged: EcomPropLibraryEntry[] = [];

  if (query.platformOnly) {
    const cat = await readPropLibraryCatalogLive();
    merged.push(...(cat.platform ?? cat.props));
  } else {
    const cat = await readPropLibraryCatalogForUser(query.userId);
    merged.push(...(cat.platform ?? []), ...(cat.user ?? []));
  }

  const textItems = merged.slice(0, limit).map((p) => propEntryToCatalogItem(p));

  const garmentProps = await loadGarmentBackedCatalogItems(query, limit, "prop", "prop");
  const seen = new Set(textItems.map((i) => i.id));
  for (const g of garmentProps) {
    if (seen.has(g.id)) continue;
    seen.add(g.id);
    textItems.push(g);
  }

  return textItems.slice(0, limit);
}

async function loadSceneItems(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<GlobalAssetCatalogItem[]> {
  const merged: EcomSceneLibraryEntry[] = [];

  if (query.platformOnly) {
    const cat = await readSceneLibraryCatalogLive();
    merged.push(...(cat.platform ?? cat.scenes));
  } else {
    const cat = await readSceneLibraryCatalogForUser(query.userId);
    merged.push(...(cat.platform ?? []), ...(cat.user ?? []));
    const seen = new Set(merged.map((s) => s.id));
    const scoped = await listSceneLibraryEntriesForViewer({
      userId: query.userId,
      tenantId: query.tenantId,
      projectId: query.projectId,
      limit,
    });
    for (const row of scoped) {
      if (!seen.has(row.id)) {
        merged.push(row);
        seen.add(row.id);
      }
    }
  }

  return merged.slice(0, limit).map((s) => sceneEntryToCatalogItem(s));
}

function applyCatalogFilters(
  items: GlobalAssetCatalogItem[],
  query: GlobalAssetCatalogQuery,
): GlobalAssetCatalogItem[] {
  let filtered = items;
  if (query.platformOnly) {
    filtered = filtered.filter((i) => i.scope === "platform");
  } else if (query.sharedOnly) {
    filtered = filtered.filter((i) => i.scope !== "platform");
  }
  const gender = query.gender?.trim();
  if (gender) {
    filtered = filtered.filter((i) => matchesGender(i, gender));
  }
  if (query.keyword?.trim()) {
    filtered = filtered.filter((i) => matchesKeyword(i, query.keyword!));
  }
  const mediaFilter = query.mediaFilter ?? "all";
  if (mediaFilter !== "all") {
    filtered = filtered.filter((i) => matchesMediaFilter(i, mediaFilter));
  }
  const poseCategory = query.poseCategory?.trim();
  if (poseCategory) {
    filtered = filtered.filter(
      (i) => i.catalogKind !== "pose" || (i.subtitle?.trim() || "未分类") === poseCategory,
    );
  }
  return filtered;
}

function matchesMediaFilter(
  item: GlobalAssetCatalogItem,
  filter: "prompt" | "image",
): boolean {
  if (item.catalogKind !== "pose") {
    return filter === "image";
  }
  if (filter === "prompt") return item.promptOnly === true;
  return item.promptOnly !== true;
}

function buildPoseFacets(
  poseItems: GlobalAssetCatalogItem[],
): NonNullable<GlobalAssetCatalogPage["facets"]> {
  let prompt = 0;
  let image = 0;
  const catMap = new Map<string, number>();
  for (const p of poseItems) {
    if (p.promptOnly) prompt += 1;
    else image += 1;
    const cat = p.subtitle?.trim() || "未分类";
    catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
  }
  return {
    poseMedia: { all: poseItems.length, prompt, image },
    poseCategories: [...catMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
      .map(([id, count]) => ({ id, label: id, count })),
  };
}

async function countKindsParallel(
  kinds: GlobalAssetCatalogKind[],
  query: GlobalAssetCatalogQuery,
  itemLimit: number,
): Promise<Record<string, number>> {
  const entries = await Promise.all(
    kinds.map(async (kind) => {
      const q: GlobalAssetCatalogQuery = {
        ...query,
        kind,
        mediaFilter: kind === "pose" ? query.mediaFilter : "all",
        poseCategory: kind === "pose" ? query.poseCategory : null,
      };
      const raw = await loadItemsForKind(kind, q, itemLimit);
      const filtered = applyCatalogFilters(raw, q);
      return [kind, filtered.length] as const;
    }),
  );
  return Object.fromEntries(entries);
}

async function loadItemsForKind(
  kind: GlobalAssetCatalogKind,
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<GlobalAssetCatalogItem[]> {
  switch (kind) {
    case "pose":
      return loadPoseItems(query.userId);
    case "avatar":
      return loadAvatarItems(query);
    case "character":
      return loadCharacterItems(query);
    case "garment":
      return loadGarmentItems(query, limit);
    case "reference":
      return loadGarmentBackedCatalogItems(query, limit, "reference", "reference");
    case "prop":
      return loadPropItems(query, limit);
    case "storyboard-image":
      return loadGarmentBackedCatalogItems(
        query,
        limit,
        "storyboard-image",
        "storyboard-image",
      );
    case "storyboard-video":
      return loadGarmentBackedCatalogItems(
        query,
        limit,
        "storyboard-video",
        "storyboard-video",
      );
    case "full-body":
      return loadFullBodyItems(query, limit);
    case "style":
      return loadStyleItems(query, limit);
    case "scene":
      return loadSceneItems(query, limit);
    case "audio":
      return [];
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}

export type GlobalAssetCatalogPage = {
  items: GlobalAssetCatalogItem[];
  counts: Record<string, number>;
  total?: number;
  hasMore?: boolean;
  facets?: {
    poseMedia?: { all: number; prompt: number; image: number };
    poseCategories?: Array<{ id: string; label: string; count: number }>;
  };
};

export async function listGlobalAssetCatalog(
  query: GlobalAssetCatalogQuery,
): Promise<GlobalAssetCatalogPage> {
  const limitParam = query.limit ?? 120;
  const limit =
    limitParam === 0 ? 0 : Math.min(Math.max(limitParam, 1), 240);
  const offset = Math.max(0, Math.floor(query.offset ?? 0));
  const requestedKind =
    query.kind && query.kind !== "all" ? query.kind : null;
  const countsKinds = (query.countsKinds ?? []).filter((k) =>
    ALL_KINDS.includes(k),
  );
  const itemLoadCap = Math.max(limit || 18, 240);

  if (countsKinds.length > 0 && limit === 0 && offset === 0) {
    const counts = await countKindsParallel(countsKinds, query, itemLoadCap);
    return { items: [], counts, total: 0, hasMore: false };
  }

  if (requestedKind) {
    const raw = await loadItemsForKind(requestedKind, query, itemLoadCap);
    const filtered = applyCatalogFilters(raw, query);
    const total = filtered.length;
    const items = limit === 0 ? [] : filtered.slice(offset, offset + limit);
    const countsScope = query.countsScope ?? "none";
    let counts: Record<string, number> =
      countsScope === "all"
        ? await buildAllKindCounts(query, itemLoadCap)
        : { [requestedKind]: total };
    if (countsKinds.length > 0) {
      const extra = await countKindsParallel(countsKinds, query, itemLoadCap);
      counts = { ...extra, ...counts };
    }
    const facets =
      requestedKind === "pose"
        ? buildPoseFacets(filtered.filter((i) => i.catalogKind === "pose"))
        : undefined;
    return {
      items,
      counts,
      total,
      hasMore: limit > 0 && offset + items.length < total,
      facets,
    };
  }

  const byKind = await buildAllKindBuckets(query, limit);
  const counts: Record<string, number> = Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, byKind[kind].length]),
  );
  const merged = ALL_KINDS.flatMap((kind) => byKind[kind]);

  return {
    items: merged.slice(0, limit),
    counts,
    total: merged.length,
    hasMore: merged.length > limit,
  };
}

async function buildAllKindCounts(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<Record<string, number>> {
  const byKind = await buildAllKindBuckets(query, limit);
  return Object.fromEntries(
    ALL_KINDS.map((kind) => [kind, byKind[kind].length]),
  );
}

async function buildAllKindBuckets(
  query: GlobalAssetCatalogQuery,
  limit: number,
): Promise<Record<GlobalAssetCatalogKind, GlobalAssetCatalogItem[]>> {
  const [
    poseRaw,
    avatarRaw,
    characterRaw,
    garmentRaw,
    referenceRaw,
    propRaw,
    storyboardImageRaw,
    storyboardVideoRaw,
    fullBodyRaw,
    styleRaw,
    sceneRaw,
  ] = await Promise.all([
    loadPoseItems(query.userId),
    loadAvatarItems(query),
    loadCharacterItems(query),
    loadGarmentItems(query, limit),
    loadGarmentBackedCatalogItems(query, limit, "reference", "reference"),
    loadGarmentBackedCatalogItems(query, limit, "prop", "prop"),
    loadGarmentBackedCatalogItems(query, limit, "storyboard-image", "storyboard-image"),
    loadGarmentBackedCatalogItems(query, limit, "storyboard-video", "storyboard-video"),
    loadFullBodyItems(query, limit),
    loadStyleItems(query, limit),
    loadSceneItems(query, limit),
  ]);

  return {
    pose: applyCatalogFilters(poseRaw, query),
    avatar: applyCatalogFilters(avatarRaw, query),
    character: applyCatalogFilters(characterRaw, query),
    garment: applyCatalogFilters(garmentRaw, query),
    reference: applyCatalogFilters(referenceRaw, query),
    prop: applyCatalogFilters(propRaw, query),
    "storyboard-image": applyCatalogFilters(storyboardImageRaw, query),
    "storyboard-video": applyCatalogFilters(storyboardVideoRaw, query),
    audio: [],
    "full-body": applyCatalogFilters(fullBodyRaw, query),
    style: applyCatalogFilters(styleRaw, query),
    scene: applyCatalogFilters(sceneRaw, query),
  };
}
