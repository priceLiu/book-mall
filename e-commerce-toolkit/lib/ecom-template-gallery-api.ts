"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  EcomTemplateCategory,
  EcomTemplateCategorySummaryRow,
  EcomTemplateGalleryCatalog,
  EcomTemplateGalleryEntry,
} from "@/lib/ecom-template-gallery/types";

const CATALOG_PATH = "api/sso/tools/ecom/template-gallery/catalog";
const SUMMARY_PATH = "api/sso/tools/ecom/template-gallery/catalog/summary";
const LOCAL_CATALOG_PATH = "/api/ecom/template-gallery/catalog";
const LOCAL_SUMMARY_PATH = "/api/ecom/template-gallery/catalog/summary";
const UPLOAD_PATH = "api/sso/tools/ecom/template-gallery/import/upload";

function withCategory(path: string, category?: EcomTemplateCategory): string {
  return category
    ? `${path}?category=${encodeURIComponent(category)}`
    : path;
}

/**
 * BFF 要回全量 catalog（现网 1400+ 条 / 约 720KB，冷查询实测约 8s）。
 * 超时过短会静默退回打包快照，导致新导入的分类被判成「敬请期待」。
 */
const CATALOG_REMOTE_TIMEOUT_MS = 20_000;

async function fetchLocalTemplateGalleryCatalog(
  category?: EcomTemplateCategory,
): Promise<EcomTemplateGalleryCatalog | null> {
  try {
    const res = await fetch(withCategory(LOCAL_CATALOG_PATH, category), {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as EcomTemplateGalleryCatalog;
  } catch {
    return null;
  }
}

async function fetchRemoteTemplateGalleryCatalog(
  timeoutMs: number,
  category?: EcomTemplateCategory,
): Promise<EcomTemplateGalleryCatalog | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await ecomBookFetch(withCategory(CATALOG_PATH, category), {
      signal: controller.signal,
    });
    return data as EcomTemplateGalleryCatalog;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export type TemplateGalleryCatalogLoad = {
  catalog: EcomTemplateGalleryCatalog;
  /** remote = 数据库权威清单；local = 打包快照，分类可能缺失，不可据此判定「敬请期待」 */
  source: "remote" | "local";
};

export async function fetchEcomTemplateGalleryCatalog(
  category?: EcomTemplateCategory,
): Promise<TemplateGalleryCatalogLoad> {
  // 退回快照会丢分类，宁可多试一次：首次冷查询会预热连接池，重试通常 2s 内返回
  for (let attempt = 0; attempt < 2; attempt++) {
    const remote = await fetchRemoteTemplateGalleryCatalog(
      CATALOG_REMOTE_TIMEOUT_MS,
      category,
    );
    if (remote) return { catalog: remote, source: "remote" };
  }

  const local = await fetchLocalTemplateGalleryCatalog(category);
  if (local) return { catalog: local, source: "local" };

  throw new Error("catalog_unavailable");
}

export type TemplateGalleryCategorySummaryLoad = {
  categories: EcomTemplateCategorySummaryRow[];
  /** local = 打包快照现算，分类可能缺失，只能用来「点亮」而不能用来判定为空 */
  source: "remote" | "local";
};

/** 分类概览：载荷 <1KB，用于分类 / 媒体开关，不再为此拉全量清单 */
export async function fetchEcomTemplateGalleryCategorySummary(): Promise<TemplateGalleryCategorySummaryLoad | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(
    () => controller.abort(),
    CATALOG_REMOTE_TIMEOUT_MS,
  );
  try {
    const data = (await ecomBookFetch(SUMMARY_PATH, {
      signal: controller.signal,
    })) as { categories?: EcomTemplateCategorySummaryRow[] };
    return { categories: data.categories ?? [], source: "remote" };
  } catch {
    /* 落到本机快照 */
  } finally {
    window.clearTimeout(timer);
  }

  try {
    const res = await fetch(LOCAL_SUMMARY_PATH, {
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      categories?: EcomTemplateCategorySummaryRow[];
    };
    return { categories: data.categories ?? [], source: "local" };
  } catch {
    return null;
  }
}

/** 导入核对：优先读本机 catalog.json（瞬时），避免 BFF 挂起阻塞队列 */
export async function fetchCatalogForImportReconcile(): Promise<EcomTemplateGalleryCatalog> {
  const local = await fetchLocalTemplateGalleryCatalog();
  if (local) return local;

  const remote = await fetchRemoteTemplateGalleryCatalog(CATALOG_REMOTE_TIMEOUT_MS);
  if (remote) return remote;

  throw new Error("catalog_unavailable");
}

/** 上传失败或中断后，用 catalog 核对是否其实已成功落库 */
export async function findEcomTemplateGalleryCatalogEntry(
  id: string,
): Promise<EcomTemplateGalleryEntry | undefined> {
  const catalog = await fetchCatalogForImportReconcile();
  return catalog.templates.find((t) => t.id === id);
}

export type TemplateGalleryUploadResponse =
  | { status: "uploaded"; entry: EcomTemplateGalleryEntry }
  | { status: "skipped"; entry: EcomTemplateGalleryEntry }
  | { status: "failed"; error: string };

export async function uploadEcomTemplateGalleryItem(
  body: {
    category: string;
    mediaKind: "image" | "video";
    id: string;
    sourceUrl: string;
    title: string;
    hot: boolean;
    ext: string;
    posterUrl?: string | null;
    thumbSourceUrl?: string | null;
  },
  options?: { signal?: AbortSignal },
): Promise<TemplateGalleryUploadResponse> {
  try {
    const data = await ecomBookFetch(UPLOAD_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: options?.signal,
    });
    return data as TemplateGalleryUploadResponse;
  } catch (e) {
    if (options?.signal?.aborted) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "上传失败";
    return { status: "failed", error: message };
  }
}
