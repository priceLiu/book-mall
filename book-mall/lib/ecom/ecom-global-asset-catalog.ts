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
import { listStyleLibraryEntriesForViewer } from "@/lib/ecom/ecom-style-library-service";
import { buildCatalogViewerScopeOr } from "@/lib/ecom/ecom-catalog-viewer-scope";
import { prisma } from "@/lib/prisma";

export type GlobalAssetCatalogKind =
  | "pose"
  | "avatar"
  | "garment"
  | "full-body"
  | "style"
  | "scene";

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
  "full-body",
  "avatar",
  "garment",
  "pose",
  "style",
  "scene",
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
  return garments.map((g) => ({
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
  }
  const gender = query.gender?.trim();
  if (gender) {
    filtered = filtered.filter((i) => matchesGender(i, gender));
  }
  if (query.keyword?.trim()) {
    filtered = filtered.filter((i) => matchesKeyword(i, query.keyword!));
  }
  return filtered;
}

export async function listGlobalAssetCatalog(
  query: GlobalAssetCatalogQuery,
): Promise<{ items: GlobalAssetCatalogItem[]; counts: Record<string, number> }> {
  const limit = Math.min(Math.max(query.limit ?? 120, 1), 240);
  const requestedKind =
    query.kind && query.kind !== "all" ? query.kind : null;

  const [poseRaw, avatarRaw, garmentRaw, fullBodyRaw, styleRaw, sceneRaw] =
    await Promise.all([
      loadPoseItems(query.userId),
      loadAvatarItems(query),
      loadGarmentItems(query, limit),
      loadFullBodyItems(query, limit),
      loadStyleItems(query, limit),
      loadSceneItems(query, limit),
    ]);

  const byKind: Record<GlobalAssetCatalogKind, GlobalAssetCatalogItem[]> = {
    pose: applyCatalogFilters(poseRaw, query),
    avatar: applyCatalogFilters(avatarRaw, query),
    garment: applyCatalogFilters(garmentRaw, query),
    "full-body": applyCatalogFilters(fullBodyRaw, query),
    style: applyCatalogFilters(styleRaw, query),
    scene: applyCatalogFilters(sceneRaw, query),
  };

  const counts: Record<string, number> = {
    pose: byKind.pose.length,
    avatar: byKind.avatar.length,
    garment: byKind.garment.length,
    "full-body": byKind["full-body"].length,
    style: byKind.style.length,
    scene: byKind.scene.length,
  };

  const merged = requestedKind
    ? byKind[requestedKind]
    : ALL_KINDS.flatMap((kind) => byKind[kind]);

  return {
    items: requestedKind ? merged : merged.slice(0, limit),
    counts,
  };
}
