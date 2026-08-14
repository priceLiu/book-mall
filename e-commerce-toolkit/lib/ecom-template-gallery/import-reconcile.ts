"use client";

import type { EcomTemplateGalleryEntry } from "@/lib/ecom-template-gallery/types";
import { fetchCatalogForImportReconcile } from "@/lib/ecom-template-gallery-api";
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

function applyCatalogHit(
  item: PersistedImportItem,
  entry: EcomTemplateGalleryEntry,
  onEntry?: (entry: EcomTemplateGalleryEntry) => void,
): PersistedImportItem {
  onEntry?.(entry);
  return {
    ...item,
    status: resolveCatalogHitStatus(item),
    progress: 100,
    error: undefined,
    retryCount: 0,
    uploadStartedAt: undefined,
  };
}

export type ReconcileImportJobOptions = {
  onEntry?: (entry: EcomTemplateGalleryEntry) => void;
  itemIds?: Set<string>;
};

export type ReconcileImportJobResult = {
  catalogSize: number;
  synced: number;
  items: PersistedImportItem[];
};

/** 单次核对（无等待）；启动 / 轮询用，不能阻塞上传队列 */
export async function reconcileImportJobItemsOnce(
  job: PersistedImportJob,
  options: ReconcileImportJobOptions = {},
): Promise<ReconcileImportJobResult> {
  let catalogSize = 0;
  let synced = 0;
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

  let byId: Map<string, EcomTemplateGalleryEntry>;
  try {
    const catalog = await fetchCatalogForImportReconcile();
    catalogSize = catalog.templates.length;
    byId = new Map(catalog.templates.map((t) => [t.id, t]));
  } catch {
    return { catalogSize: 0, synced: 0, items };
  }

  const nextItems = items.map((it) => {
    if (!targetIds.has(it.id) || isFinishedImportStatus(it.status)) return it;
    const entry = byId.get(it.id);
    if (!entry) return it;
    synced += 1;
    return applyCatalogHit(it, entry, options.onEntry);
  });

  return { catalogSize, synced, items: nextItems };
}

/** 上传响应丢失后：等待 catalog 写入并多次核对 */
export async function reconcileImportItemAfterUploadLoss(
  itemId: string,
  onEntry?: (entry: EcomTemplateGalleryEntry) => void,
): Promise<EcomTemplateGalleryEntry | null> {
  for (let attempt = 0; attempt <= POST_UPLOAD_RECONCILE_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      await sleep(POST_UPLOAD_RECONCILE_DELAYS_MS[attempt - 1]!);
    }
    try {
      const catalog = await fetchCatalogForImportReconcile();
      const entry = catalog.templates.find((t) => t.id === itemId);
      if (entry) {
        onEntry?.(entry);
        return entry;
      }
    } catch {
      /* 下一轮 */
    }
  }
  return null;
}

/** @deprecated 使用 reconcileImportJobItemsOnce；保留别名避免遗漏引用 */
export const reconcileImportJobItems = reconcileImportJobItemsOnce;
