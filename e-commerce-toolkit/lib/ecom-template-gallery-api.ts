"use client";

import { ecomBookFetch } from "@/lib/ecom-book-fetch";
import type {
  EcomTemplateGalleryCatalog,
  EcomTemplateGalleryEntry,
} from "@/lib/ecom-template-gallery/types";

const CATALOG_PATH = "api/sso/tools/ecom/template-gallery/catalog";
const LOCAL_CATALOG_PATH = "/api/ecom/template-gallery/catalog";
const UPLOAD_PATH = "api/sso/tools/ecom/template-gallery/import/upload";

const CATALOG_REMOTE_TIMEOUT_MS = 6000;

async function fetchLocalTemplateGalleryCatalog(): Promise<EcomTemplateGalleryCatalog | null> {
  try {
    const res = await fetch(LOCAL_CATALOG_PATH, {
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
): Promise<EcomTemplateGalleryCatalog | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const data = await ecomBookFetch(CATALOG_PATH, { signal: controller.signal });
    return data as EcomTemplateGalleryCatalog;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchEcomTemplateGalleryCatalog(): Promise<EcomTemplateGalleryCatalog> {
  const remote = await fetchRemoteTemplateGalleryCatalog(CATALOG_REMOTE_TIMEOUT_MS);
  if (remote) return remote;

  const local = await fetchLocalTemplateGalleryCatalog();
  if (local) return local;

  throw new Error("catalog_unavailable");
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
