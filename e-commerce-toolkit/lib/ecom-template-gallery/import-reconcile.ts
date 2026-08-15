"use client";

import type {
  EcomTemplateCategory,
  EcomTemplateGalleryEntry,
} from "@/lib/ecom-template-gallery/types";
import {
  fetchEcomTemplateGalleryCatalog,
  fetchEcomTemplateGalleryExistingIds,
  invalidateEcomTemplateGalleryExistingIds,
} from "@/lib/ecom-template-gallery-api";
import type {
  PersistedImportItem,
  PersistedImportJob,
} from "@/lib/ecom-template-gallery/import-storage";

const POST_UPLOAD_RECONCILE_DELAYS_MS = [400, 1200, 2500];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function isFinishedImportStatus(status: PersistedImportItem["status"]): boolean {
  return status === "success" || status === "skipped" || status === "cancelled";
}

/** 已开始上传后 catalog 命中 → 视为本次成功；仅排队且未尝试 → 已存在跳过 */
function resolveCatalogHitStatus(item: PersistedImportItem): "success" | "skipped" {
  if (
    item.status === "uploading" ||
    item.status === "failed" ||
    item.uploadStartedAt != null ||
    (item.retryCount ?? 0) > 0
  ) {
    return "success";
  }
  return "skipped";
}

/** id 已在库即算完成；能否取到整条目只影响画廊补格子，不该因此重传 */
function applyCatalogHit(item: PersistedImportItem): PersistedImportItem {
  return {
    ...item,
    status: resolveCatalogHitStatus(item),
    progress: 100,
    error: undefined,
    retryCount: 0,
    uploadStartedAt: undefined,
  };
}

/**
 * 整条目仅供画廊补格子，且该请求可能重试到 40s；必须异步进行，
 * 否则核对会卡住上传队列。
 */
function emitEntriesForHits(
  category: string | undefined,
  hitIds: Set<string>,
  onEntry: (entry: EcomTemplateGalleryEntry) => void,
): void {
  void fetchEcomTemplateGalleryCatalog(
    category as EcomTemplateCategory | undefined,
  )
    .then(({ catalog }) => {
      for (const t of catalog.templates) {
        if (hitIds.has(t.id)) onEntry(t);
      }
    })
    .catch(() => {
      /* 画廊等下次分类刷新 */
    });
}

export type ReconcileImportJobOptions = {
  onEntry?: (entry: EcomTemplateGalleryEntry) => void;
  itemIds?: Set<string>;
};

export type ReconcileImportJobResult = {
  /** 参与比对的 id 数（按分类取数时即该分类条目数） */
  catalogSize: number;
  synced: number;
  items: PersistedImportItem[];
};

/** 一批条目同属一个分类时按分类取数；跨分类则退回全量 */
function sharedCategory(
  items: PersistedImportItem[],
  targetIds: Set<string>,
): string | undefined {
  let category: string | undefined;
  for (const it of items) {
    if (!targetIds.has(it.id)) continue;
    if (!it.category) return undefined;
    if (category && category !== it.category) return undefined;
    category = it.category;
  }
  return category;
}

/** 单次核对（无等待）；启动 / 轮询用，不能阻塞上传队列 */
export async function reconcileImportJobItemsOnce(
  job: PersistedImportJob,
  options: ReconcileImportJobOptions = {},
): Promise<ReconcileImportJobResult> {
  const items = job.items;

  const targetIds =
    options.itemIds ??
    new Set(
      items
        .filter((it) => !isFinishedImportStatus(it.status))
        .map((it) => it.id),
    );

  if (targetIds.size === 0) {
    return { catalogSize: 0, synced: 0, items };
  }

  const category = sharedCategory(items, targetIds);
  const existing = await fetchEcomTemplateGalleryExistingIds(category);
  if (!existing) return { catalogSize: 0, synced: 0, items };

  const hitIds = new Set(
    items
      .filter(
        (it) =>
          targetIds.has(it.id) &&
          !isFinishedImportStatus(it.status) &&
          existing.ids.has(it.id),
      )
      .map((it) => it.id),
  );

  const catalogSize = existing.ids.size;
  if (hitIds.size === 0) return { catalogSize, synced: 0, items };

  if (options.onEntry) emitEntriesForHits(category, hitIds, options.onEntry);

  let synced = 0;
  const nextItems = items.map((it) => {
    if (!hitIds.has(it.id)) return it;
    synced += 1;
    return applyCatalogHit(it);
  });

  return { catalogSize, synced, items: nextItems };
}

/**
 * 上传响应丢失后：等待写入完成并多次核对。
 * 返回 true 表示已在库，调用方 **不得** 重传。
 */
export async function reconcileImportItemAfterUploadLoss(
  itemId: string,
  category?: string,
  onEntry?: (entry: EcomTemplateGalleryEntry) => void,
): Promise<boolean> {
  for (let attempt = 0; attempt <= POST_UPLOAD_RECONCILE_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(POST_UPLOAD_RECONCILE_DELAYS_MS[attempt - 1]!);
    }
    // 正是在等刚写入的条目，不能被 TTL 内的旧清单挡住
    invalidateEcomTemplateGalleryExistingIds();
    const existing = await fetchEcomTemplateGalleryExistingIds(category);
    if (!existing?.ids.has(itemId)) continue;

    if (onEntry) emitEntriesForHits(category, new Set([itemId]), onEntry);
    return true;
  }
  return false;
}

/** @deprecated 使用 reconcileImportJobItemsOnce；保留别名避免遗漏引用 */
export const reconcileImportJobItems = reconcileImportJobItemsOnce;
