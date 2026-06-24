import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import {
  isCanvasToolsSessionUnauthorized,
  refreshCanvasToolsSessionClient,
} from "@/lib/canvas-tools-session-client";
import type {
  SaveVideoToLibraryInput,
  VideoLibraryItem,
  VideoLibraryQuota,
} from "@/lib/canvas-video-library-types";

export type {
  SaveVideoToLibraryInput,
  VideoLibraryItem,
  VideoLibraryQuota,
} from "@/lib/canvas-video-library-types";

const LIBRARY_PATH = "/api/canvas/video-library";
const PERSIST_PATH = "/api/canvas/video-library/persist-from-url";

async function libraryFetch<T>(
  base: string,
  apiPath: string,
  init?: RequestInit,
): Promise<T> {
  const { url, init: merged } = resolveBookMallBrowserRequest(base, apiPath, init);
  let sessionRefreshAttempted = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, merged);
    const raw = await r.text();
    let data: Record<string, unknown> = {};
    try {
      data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
    } catch {
      /* ignore */
    }

    if (!r.ok) {
      const msg =
        (typeof data.message === "string" ? data.message : null) ??
        (typeof data.error === "string" ? data.error : null) ??
        raw.slice(0, 200);
      if (
        typeof window !== "undefined" &&
        !sessionRefreshAttempted &&
        isCanvasToolsSessionUnauthorized(msg, r.status)
      ) {
        sessionRefreshAttempted = true;
        const refreshed = await refreshCanvasToolsSessionClient();
        if (refreshed) continue;
      }
      throw new Error(msg || `请求失败（HTTP ${r.status}）`);
    }

    return (raw ? JSON.parse(raw) : {}) as T;
  }

  throw new Error("401 未授权");
}

export async function listVideoLibrary(
  base: string,
): Promise<{ items: VideoLibraryItem[]; quota: VideoLibraryQuota | null }> {
  const data = await libraryFetch<{
    items?: VideoLibraryItem[];
    quota?: VideoLibraryQuota;
  }>(base, LIBRARY_PATH, { method: "GET" });

  return {
    items: Array.isArray(data.items) ? data.items : [],
    quota:
      data.quota &&
      typeof data.quota.used === "number" &&
      typeof data.quota.max === "number"
        ? data.quota
        : null,
  };
}

export async function saveVideoToLibrary(
  base: string,
  input: SaveVideoToLibraryInput,
): Promise<{ item: VideoLibraryItem; quota: VideoLibraryQuota | null }> {
  const data = await libraryFetch<{
    item?: VideoLibraryItem;
    quota?: VideoLibraryQuota;
    error?: string;
    message?: string;
  }>(base, PERSIST_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceUrl: input.sourceUrl,
      mode: input.mode,
      prompt: input.prompt ?? null,
      modelLabel: input.modelLabel ?? null,
      resolution: input.resolution ?? "720P",
      durationSec: input.durationSec ?? 5,
    }),
  });

  if (data.error === "LIBRARY_FULL" || data.error === "video_library_full") {
    throw new Error(
      (typeof data.message === "string" ? data.message : null) ??
        "我的视频库已满，请删除旧条目后再保存。",
    );
  }
  if (!data.item?.id) {
    throw new Error("保存成功但响应缺少条目信息");
  }
  window.dispatchEvent(new CustomEvent("canvas:video-library-changed"));
  return {
    item: data.item,
    quota:
      data.quota &&
      typeof data.quota.used === "number" &&
      typeof data.quota.max === "number"
        ? data.quota
        : null,
  };
}

export async function deleteVideoLibraryItem(
  base: string,
  id: string,
): Promise<void> {
  const path = `${LIBRARY_PATH}?id=${encodeURIComponent(id)}`;
  await libraryFetch<{ ok?: boolean }>(base, path, { method: "DELETE" });
  window.dispatchEvent(new CustomEvent("canvas:video-library-changed"));
}

/** 从节点 params 推断入库分辨率标签 */
export function refVideoResolutionFromParams(
  params: Record<string, unknown> | undefined,
): "720P" | "1080P" {
  const r = params?.resolution ?? params?.size;
  if (typeof r === "string" && /1080/i.test(r)) return "1080P";
  return "720P";
}

export function refVideoDurationFromParams(
  params: Record<string, unknown> | undefined,
): number {
  const d = params?.duration ?? params?.durationSec;
  if (typeof d === "number" && Number.isFinite(d)) {
    return Math.min(600, Math.max(1, Math.round(d)));
  }
  if (typeof d === "string" && /^\d+$/.test(d.trim())) {
    return Math.min(600, Math.max(1, Number.parseInt(d.trim(), 10)));
  }
  return 5;
}
