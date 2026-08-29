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
  type StoryboardSheet,
} from "@/lib/ecom/ecom-storyboard-types";

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

export async function loadLatestStoryboardPanelImageUrls(
  userId: string,
  projectId: string,
): Promise<Map<number, string>> {
  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "image",
      meta: {
        path: ["projectId"],
        equals: projectId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { ossUrl: true, meta: true },
  });

  const map = new Map<number, string>();
  for (const asset of assets) {
    const meta = asset.meta as Record<string, unknown> | null;
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
  const assets = await prisma.ecomAsset.findMany({
    where: {
      userId,
      module: ECOM_STORYBOARD_MODULE,
      kind: "video",
      meta: {
        path: ["projectId"],
        equals: projectId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: { ossUrl: true, meta: true },
  });

  const map = new Map<number, string>();
  for (const asset of assets) {
    const meta = asset.meta as Record<string, unknown> | null;
    if (meta?.kind !== "panel_video") continue;
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

  const [latestImages, latestVideos] = await Promise.all([
    loadLatestStoryboardPanelImageUrls(opts.userId, opts.projectId),
    loadLatestStoryboardPanelVideoUrls(opts.userId, opts.projectId),
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
    if (!next.videoUrl?.trim()) {
      const videoUrl = latestVideos.get(p.index);
      if (videoUrl) {
        dirty = true;
        next = { ...next, videoUrl };
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
