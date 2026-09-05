import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  clearStoryboardPanelImagesPending,
  readStoryboardPendingPanelImages,
} from "@/lib/ecom/ecom-storyboard-pending-images";
import {
  clearStoryboardPanelVideosPending,
  readStoryboardPendingPanelVideos,
} from "@/lib/ecom/ecom-storyboard-pending-videos";
import {
  ECOM_STORYBOARD_MODULE,
  parseStoryboardSheet,
  storyboardSheetSchema,
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";
import {
  mergeStoryboardPanelVideoGen,
  parseStoryboardPanelVideoGenFromAssetMeta,
  type StoryboardPanelVideoAssetRecord,
} from "@/lib/ecom/ecom-storyboard-panel-video-gen";

/** 按镜号合并 imageUrl / videoUrl，保留 base 脚本字段；incoming 中多出的镜追加到末尾 */
export function mergeStoryboardPanelMediaByIndex(
  basePanels: StoryboardSheet["panels"],
  incomingPanels: StoryboardSheet["panels"],
): StoryboardSheet["panels"] {
  const incomingByIndex = new Map(incomingPanels.map((p) => [p.index, p]));
  const seen = new Set<number>();
  const merged = basePanels.map((p) => {
    seen.add(p.index);
    const incoming = incomingByIndex.get(p.index);
    if (!incoming) return p;
    return {
      ...p,
      ...(incoming.imageUrl?.trim() ? { imageUrl: incoming.imageUrl.trim() } : {}),
      ...(incoming.videoUrl?.trim() ? { videoUrl: incoming.videoUrl.trim() } : {}),
    };
  });
  for (const incoming of incomingPanels) {
    if (seen.has(incoming.index)) continue;
    merged.push(incoming);
  }
  return merged.sort((a, b) => a.index - b.index);
}

/** 合并前从 ecomAsset 补全 sheet 上缺失的 panel videoUrl / videoGen（避免 timeline 漏镜） */
export async function enrichStoryboardSheetVideoUrlsForMerge(
  userId: string,
  projectId: string,
  sheet: StoryboardSheet,
): Promise<StoryboardSheet> {
  const latestVideos = await loadLatestStoryboardPanelVideoRecords(
    userId,
    projectId,
  );
  if (latestVideos.size === 0) return sheet;
  let changed = false;
  const panels = sheet.panels.map((p) => {
    const record = latestVideos.get(p.index);
    if (!record) return p;
    const nextUrl = p.videoUrl?.trim() || record.url;
    const nextGen = mergeStoryboardPanelVideoGen(p.videoGen, {
      modelKey: record.modelKey,
      durationSec: record.durationSec,
      resolution: record.resolution,
      aspectRatio: record.aspectRatio,
      generatedAt: record.generatedAt,
    });
    const urlChanged = nextUrl !== p.videoUrl?.trim();
    const genChanged =
      JSON.stringify(nextGen ?? null) !== JSON.stringify(p.videoGen ?? null);
    if (!urlChanged && !genChanged) return p;
    changed = true;
    return {
      ...p,
      ...(nextUrl ? { videoUrl: nextUrl } : {}),
      ...(nextGen ? { videoGen: nextGen } : {}),
    };
  });
  return changed ? { ...sheet, panels } : sheet;
}

function assetMetaProjectId(meta: Record<string, unknown> | null): string | null {
  const id = meta?.projectId;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

export async function loadLatestStoryboardPanelVideoRecords(
  userId: string,
  projectId: string,
): Promise<Map<number, StoryboardPanelVideoAssetRecord>> {
  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "video",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { ossUrl: true, meta: true, createdAt: true },
  });

  const map = new Map<number, StoryboardPanelVideoAssetRecord>();
  for (const asset of assets) {
    const meta = asset.meta as Record<string, unknown> | null;
    if (assetMetaProjectId(meta) !== projectId) continue;
    if (meta?.kind !== "panel_video") continue;
    const panelIndex =
      typeof meta.panelIndex === "number" ? Math.trunc(meta.panelIndex) : NaN;
    if (!Number.isFinite(panelIndex) || panelIndex <= 0) continue;
    if (map.has(panelIndex)) continue;
    const url = asset.ossUrl?.trim();
    if (!url || !/^https?:\/\//.test(url)) continue;
    const gen =
      parseStoryboardPanelVideoGenFromAssetMeta(meta) ??
      (typeof meta.modelKey === "string" && meta.modelKey.trim()
        ? {
            modelKey: meta.modelKey.trim(),
            durationSec: 3,
            generatedAt: asset.createdAt.toISOString(),
          }
        : null);
    if (!gen) continue;
    map.set(panelIndex, {
      url,
      ...gen,
      generatedAt: gen.generatedAt ?? asset.createdAt.toISOString(),
    });
  }
  return map;
}

export async function loadLatestStoryboardPanelImageUrls(
  userId: string,
  projectId: string,
): Promise<Map<number, string>> {
  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "image",
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { ossUrl: true, meta: true },
  });

  const map = new Map<number, string>();
  for (const asset of assets) {
    const meta = asset.meta as Record<string, unknown> | null;
    if (assetMetaProjectId(meta) !== projectId) continue;
    if (meta?.kind !== "storyboard_panel") continue;
    const panelIndex =
      typeof meta.panelIndex === "number" ? Math.trunc(meta.panelIndex) : NaN;
    if (!Number.isFinite(panelIndex) || panelIndex <= 0) continue;
    if (map.has(panelIndex)) continue;
    const url = asset.ossUrl?.trim();
    if (!url || !/^https?:\/\//.test(url)) continue;
    map.set(panelIndex, url);
  }
  return map;
}

export async function loadLatestStoryboardPanelVideoUrls(
  userId: string,
  projectId: string,
): Promise<Map<number, string>> {
  const records = await loadLatestStoryboardPanelVideoRecords(userId, projectId);
  const map = new Map<number, string>();
  for (const [index, record] of records) {
    map.set(index, record.url);
  }
  return map;
}

/** 并发分镜生图：按镜号写入 imageUrl，乐观锁重试避免互相覆盖 */
export async function persistStoryboardPanelImageUrl(opts: {
  userId: string;
  projectId: string;
  panelIndex: number;
  imageUrl: string;
}): Promise<void> {
  const imageUrl = opts.imageUrl.trim();
  if (!imageUrl) throw new Error("分镜图 URL 为空");
  const panelIndex = Math.trunc(opts.panelIndex);
  if (!Number.isFinite(panelIndex) || panelIndex <= 0) {
    throw new Error("无效镜头序号");
  }

  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const row = await prisma.ecomStoryboardProject.findFirst({
      where: { id: opts.projectId, userId: opts.userId },
      select: { sheet: true, updatedAt: true },
    });
    if (!row) throw new Error("项目不存在");
    const sheet = storyboardSheetSchema.parse(row.sheet);
    if (!sheet?.panels?.length) throw new Error("分镜表为空");
    const target = sheet.panels.find((p) => p.index === panelIndex);
    if (!target) throw new Error(`找不到镜头 ${panelIndex}`);

    const mergedPanels = mergeStoryboardPanelMediaByIndex(sheet.panels, [
      { ...target, imageUrl },
    ]);
    const allReady = mergedPanels.every((p) => Boolean(p.imageUrl?.trim()));
    const nextSheet = storyboardSheetSchema.parse({ ...sheet, panels: mergedPanels });

    const updated = await prisma.ecomStoryboardProject.updateMany({
      where: {
        id: opts.projectId,
        userId: opts.userId,
        updatedAt: row.updatedAt,
      },
      data: {
        sheet: nextSheet as unknown as Prisma.InputJsonValue,
        status: allReady ? "image_ready" : "image_partial",
      },
    });
    if (updated.count === 1) return;
  }
  throw new Error("分镜图保存冲突，请刷新页面后重试");
}

export type ReconcileStoryboardSheetResult = {
  sheet: StoryboardSheet | null;
  dirty: boolean;
  /** 已有 imageUrl 但仍标记 pending 的镜号（需清 meta） */
  stalePendingPanelIndexes: number[];
  /** 已有 videoUrl 但仍标记 pending 的镜号 */
  stalePendingPanelVideoIndexes: number[];
};

/** 从 ecomAsset 回填 sheet 缺失的 panel imageUrl / videoUrl */
export async function reconcileStoryboardSheetPanelImages(opts: {
  userId: string;
  projectId: string;
  sheet: StoryboardSheet | null;
  meta: unknown;
}): Promise<ReconcileStoryboardSheetResult> {
  if (!opts.sheet?.panels?.length) {
    return {
      sheet: opts.sheet,
      dirty: false,
      stalePendingPanelIndexes: [],
      stalePendingPanelVideoIndexes: [],
    };
  }

  const [latestImages, latestVideoRecords] = await Promise.all([
    loadLatestStoryboardPanelImageUrls(opts.userId, opts.projectId),
    loadLatestStoryboardPanelVideoRecords(opts.userId, opts.projectId),
  ]);

  let dirty = false;
  const panels = opts.sheet.panels.map((p) => {
    let next = p;
    if (!p.imageUrl?.trim()) {
      const imageUrl = latestImages.get(p.index);
      if (imageUrl) {
        dirty = true;
        next = { ...next, imageUrl };
      }
    }
    const videoRecord = latestVideoRecords.get(p.index);
    if (!next.videoUrl?.trim() && videoRecord?.url) {
      dirty = true;
      next = { ...next, videoUrl: videoRecord.url };
    }
    if (!next.videoGen?.modelKey && videoRecord) {
      const mergedGen = mergeStoryboardPanelVideoGen(undefined, {
        modelKey: videoRecord.modelKey,
        durationSec: videoRecord.durationSec,
        resolution: videoRecord.resolution,
        aspectRatio: videoRecord.aspectRatio,
        generatedAt: videoRecord.generatedAt,
      });
      if (mergedGen) {
        dirty = true;
        next = { ...next, videoGen: mergedGen };
      }
    }
    return next;
  });

  const pendingImages = readStoryboardPendingPanelImages(opts.meta);
  const pendingVideos = readStoryboardPendingPanelVideos(opts.meta);
  const stalePendingPanelIndexes = panels
    .filter((p) => p.imageUrl?.trim() && pendingImages[String(p.index)])
    .map((p) => p.index);
  const stalePendingPanelVideoIndexes = panels
    .filter((p) => p.videoUrl?.trim() && pendingVideos[String(p.index)])
    .map((p) => p.index);

  if (!dirty) {
    return {
      sheet: opts.sheet,
      dirty: false,
      stalePendingPanelIndexes,
      stalePendingPanelVideoIndexes,
    };
  }

  return {
    sheet: parseStoryboardSheet({ ...opts.sheet, panels }),
    dirty: true,
    stalePendingPanelIndexes,
    stalePendingPanelVideoIndexes,
  };
}

export async function applyStoryboardSheetReconcile(
  userId: string,
  projectId: string,
  sheet: StoryboardSheet | null,
  meta: unknown,
): Promise<{ sheet: StoryboardSheet | null; meta: unknown; dirty: boolean }> {
  const reconciled = await reconcileStoryboardSheetPanelImages({
    userId,
    projectId,
    sheet,
    meta,
  });

  let dirty = reconciled.dirty;
  let nextSheet = reconciled.sheet;
  let nextMeta = meta;

  if (reconciled.stalePendingPanelIndexes.length > 0) {
    await clearStoryboardPanelImagesPending(
      projectId,
      reconciled.stalePendingPanelIndexes,
    );
    dirty = true;
  }
  if (reconciled.stalePendingPanelVideoIndexes.length > 0) {
    await clearStoryboardPanelVideosPending(
      projectId,
      reconciled.stalePendingPanelVideoIndexes,
    );
    dirty = true;
  }
  if (
    reconciled.stalePendingPanelIndexes.length > 0 ||
    reconciled.stalePendingPanelVideoIndexes.length > 0
  ) {
    const fresh = await prisma.ecomStoryboardProject.findFirst({
      where: { id: projectId },
      select: { meta: true },
    });
    if (fresh?.meta) nextMeta = fresh.meta;
  }

  return { sheet: nextSheet, meta: nextMeta, dirty };
}
