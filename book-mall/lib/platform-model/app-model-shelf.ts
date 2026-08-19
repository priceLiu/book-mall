/**
 * 应用/场景级模型上架（模型运营中心 · L5 应用分发）
 */
import type { AppModelShelfStatus } from "@prisma/client";

import { invalidateGatewayModelListCache } from "@/lib/gateway/model-list-cache";
import { prisma } from "@/lib/prisma";

export type ShelfFilterContext = {
  appTag: string;
  sceneKey?: string | null;
};

export type ShelfRowForAdmin = {
  id: string;
  appTag: string;
  sceneKey: string;
  canonicalModelKey: string;
  status: AppModelShelfStatus;
  sortOrder: number;
  displayNameOverride: string | null;
  sourceLabelOverride: string | null;
  catalogDisplayName: string | null;
  catalogSourceLabel: string | null;
};

type ShelfIndex = {
  /** 该 app+scene 是否有任何 shelf 记录（用于兼容：无记录则不筛选） */
  hasShelfForScope: boolean;
  /** canonicalKey → shelf row（仅 ACTIVE） */
  activeByCanonical: Map<
    string,
    {
      sortOrder: number;
      displayNameOverride: string | null;
      sourceLabelOverride: string | null;
    }
  >;
};

function normalizeSceneKey(sceneKey?: string | null): string {
  return sceneKey?.trim() ?? "";
}

function normalizeAppTag(appTag: string): string {
  return appTag.trim().toLowerCase();
}

/** 加载某 app 下全部 shelf 行并构建索引（进程内由 listModelsForApp 调用）。 */
export async function loadShelfIndexForApp(appTag: string): Promise<Map<string, ShelfIndex>> {
  const tag = normalizeAppTag(appTag);
  const rows = await prisma.appModelShelf.findMany({
    where: { appTag: tag },
    orderBy: [{ sceneKey: "asc" }, { sortOrder: "asc" }],
  });

  const byScene = new Map<string, ShelfIndex>();

  for (const row of rows) {
    const scene = row.sceneKey;
    let idx = byScene.get(scene);
    if (!idx) {
      idx = { hasShelfForScope: true, activeByCanonical: new Map() };
      byScene.set(scene, idx);
    }
    if (row.status === "ACTIVE") {
      idx.activeByCanonical.set(row.canonicalModelKey, {
        sortOrder: row.sortOrder,
        displayNameOverride: row.displayNameOverride,
        sourceLabelOverride: row.sourceLabelOverride,
      });
    }
  }

  return byScene;
}

/**
 * 判断 canonical 是否对当前 app+scene 可见。
 * 兼容：若该 scope 无任何 shelf 记录，则全部可见。
 */
export function isCanonicalVisibleOnShelf(
  shelfByScene: Map<string, ShelfIndex>,
  canonicalModelKey: string,
  ctx: ShelfFilterContext,
): boolean {
  const scene = normalizeSceneKey(ctx.sceneKey);
  const sceneIdx = shelfByScene.get(scene);
  if (sceneIdx?.hasShelfForScope) {
    return sceneIdx.activeByCanonical.has(canonicalModelKey);
  }

  const globalIdx = shelfByScene.get("");
  if (globalIdx?.hasShelfForScope) {
    return globalIdx.activeByCanonical.has(canonicalModelKey);
  }

  return true;
}

export function getShelfMetaForCanonical(
  shelfByScene: Map<string, ShelfIndex>,
  canonicalModelKey: string,
  ctx: ShelfFilterContext,
): {
  sortOrder: number;
  displayNameOverride: string | null;
  sourceLabelOverride: string | null;
} | null {
  const scene = normalizeSceneKey(ctx.sceneKey);
  const sceneRow = shelfByScene.get(scene)?.activeByCanonical.get(canonicalModelKey);
  if (sceneRow) return sceneRow;
  const globalRow = shelfByScene.get("")?.activeByCanonical.get(canonicalModelKey);
  return globalRow ?? null;
}

export async function listShelfForAdmin(filters?: {
  appTag?: string;
  sceneKey?: string;
}): Promise<ShelfRowForAdmin[]> {
  const where: { appTag?: string; sceneKey?: string } = {};
  if (filters?.appTag) where.appTag = normalizeAppTag(filters.appTag);
  if (filters?.sceneKey !== undefined) where.sceneKey = normalizeSceneKey(filters.sceneKey);

  const rows = await prisma.appModelShelf.findMany({
    where,
    orderBy: [{ appTag: "asc" }, { sceneKey: "asc" }, { sortOrder: "asc" }],
  });

  const canonicalKeys = [...new Set(rows.map((r) => r.canonicalModelKey))];
  const catalogs =
    canonicalKeys.length > 0
      ? await prisma.modelCatalog.findMany({
          where: { canonicalKey: { in: canonicalKeys } },
          select: { canonicalKey: true, displayName: true, sourceLabel: true },
        })
      : [];
  const catalogByKey = new Map(catalogs.map((c) => [c.canonicalKey, c]));

  return rows.map((r) => {
    const cat = catalogByKey.get(r.canonicalModelKey);
    return {
      id: r.id,
      appTag: r.appTag,
      sceneKey: r.sceneKey,
      canonicalModelKey: r.canonicalModelKey,
      status: r.status,
      sortOrder: r.sortOrder,
      displayNameOverride: r.displayNameOverride,
      sourceLabelOverride: r.sourceLabelOverride,
      catalogDisplayName: cat?.displayName ?? null,
      catalogSourceLabel: cat?.sourceLabel ?? null,
    };
  });
}

export async function upsertShelfRows(
  rows: Array<{
    appTag: string;
    sceneKey?: string;
    canonicalModelKey: string;
    status: AppModelShelfStatus;
    sortOrder?: number;
    displayNameOverride?: string | null;
    sourceLabelOverride?: string | null;
  }>,
): Promise<number> {
  let count = 0;
  for (const row of rows) {
    const appTag = normalizeAppTag(row.appTag);
    const sceneKey = normalizeSceneKey(row.sceneKey);
    await prisma.appModelShelf.upsert({
      where: {
        appTag_sceneKey_canonicalModelKey: {
          appTag,
          sceneKey,
          canonicalModelKey: row.canonicalModelKey,
        },
      },
      create: {
        appTag,
        sceneKey,
        canonicalModelKey: row.canonicalModelKey,
        status: row.status,
        sortOrder: row.sortOrder ?? 0,
        displayNameOverride: row.displayNameOverride ?? null,
        sourceLabelOverride: row.sourceLabelOverride ?? null,
      },
      update: {
        status: row.status,
        sortOrder: row.sortOrder ?? 0,
        displayNameOverride: row.displayNameOverride ?? null,
        sourceLabelOverride: row.sourceLabelOverride ?? null,
      },
    });
    count += 1;
  }
  invalidateGatewayModelListCache();
  return count;
}

export async function batchUpdateShelfStatus(input: {
  appTag: string;
  sceneKey?: string;
  canonicalModelKeys: string[];
  status: AppModelShelfStatus;
}): Promise<number> {
  const appTag = normalizeAppTag(input.appTag);
  const sceneKey = normalizeSceneKey(input.sceneKey);
  const result = await prisma.appModelShelf.updateMany({
    where: {
      appTag,
      sceneKey,
      canonicalModelKey: { in: input.canonicalModelKeys },
    },
    data: { status: input.status },
  });
  invalidateGatewayModelListCache();
  return result.count;
}

export async function updateCatalogSourceLabels(
  updates: Array<{ canonicalModelKey: string; sourceLabel: string | null }>,
): Promise<number> {
  let count = 0;
  for (const u of updates) {
    await prisma.modelCatalog.updateMany({
      where: { canonicalKey: u.canonicalModelKey },
      data: { sourceLabel: u.sourceLabel },
    });
    count += 1;
  }
  invalidateGatewayModelListCache();
  return count;
}

export async function listCatalogPresentationForAdmin(): Promise<
  Array<{
    canonicalModelKey: string;
    displayName: string;
    sourceLabel: string | null;
    appTags: string[];
    role: string | null;
    gatewayPublished: boolean;
  }>
> {
  const rows = await prisma.modelCatalog.findMany({
    where: { gatewayPublished: true },
    orderBy: { displayName: "asc" },
    select: {
      canonicalKey: true,
      displayName: true,
      sourceLabel: true,
      appTags: true,
      role: true,
      gatewayPublished: true,
    },
  });
  return rows.map((r) => ({
    canonicalModelKey: r.canonicalKey,
    displayName: r.displayName,
    sourceLabel: r.sourceLabel,
    appTags: r.appTags,
    role: r.role,
    gatewayPublished: r.gatewayPublished,
  }));
}

/** 某 app+scene 是否已有 shelf 记录（管理端提示用）。 */
export async function hasShelfRecordsForScope(appTag: string, sceneKey?: string): Promise<boolean> {
  const count = await prisma.appModelShelf.count({
    where: {
      appTag: normalizeAppTag(appTag),
      sceneKey: normalizeSceneKey(sceneKey),
    },
  });
  return count > 0;
}
