import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";
import type {
  SaveVideoToLibraryInput,
  VideoLibraryItem,
  VideoLibraryQuota,
} from "@/lib/canvas-video-library-types";

const LIBRARY_PATH = "/api/sso/tools/image-to-video/library";
const PERSIST_PATH = "/api/sso/tools/image-to-video/library/persist-from-url";

async function parseJson<T>(r: Response): Promise<T> {
  return (await r.json()) as T;
}

export async function listVideoLibrary(
  base: string,
): Promise<{ items: VideoLibraryItem[]; quota: VideoLibraryQuota | null }> {
  const { url, init } = resolveBookMallBrowserRequest(base, LIBRARY_PATH, {
    method: "GET",
  });
  const r = await fetch(url, init);
  const data = await parseJson<{
    items?: VideoLibraryItem[];
    quota?: VideoLibraryQuota;
    error?: string;
  }>(r);
  if (!r.ok) {
    throw new Error(data.error ?? "加载视频库失败");
  }
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
  const { url, init } = resolveBookMallBrowserRequest(base, PERSIST_PATH, {
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
  const r = await fetch(url, init);
  const data = await parseJson<{
    item?: VideoLibraryItem;
    quota?: VideoLibraryQuota;
    error?: string;
    message?: string;
  }>(r);
  if (!r.ok) {
    if (data.error === "video_library_full") {
      throw new Error(
        data.message ??
          "我的视频库已满，请删除旧条目后再保存。",
      );
    }
    throw new Error(data.error ?? data.message ?? "保存到视频库失败");
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
  const { url, init } = resolveBookMallBrowserRequest(base, path, {
    method: "DELETE",
  });
  const r = await fetch(url, init);
  const data = await parseJson<{ error?: string }>(r);
  if (!r.ok) {
    throw new Error(data.error ?? "删除失败");
  }
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
