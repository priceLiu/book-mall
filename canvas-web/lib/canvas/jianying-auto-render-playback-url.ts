import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

import { isMediaRenderSessionLocalUrl } from "./media-render-session-url";
import type { JianyingMediaRenderResult } from "./types";

function trimUrl(v: string | null | undefined): string {
  return v?.trim() || "";
}

/** mediaRenderResult.expiresAt 过期（临时成片 OSS 已删） */
export function isJianyingMediaRenderDownloadExpired(
  expiresAt: string | null | undefined,
): boolean {
  const raw = expiresAt?.trim();
  if (!raw) return false;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

/**
 * 自动成片节点 · 可播放 URL。
 * - 有 OSS 成片时优先 mediaRenderResult（避免落库的 BFF /download 刷新后 404）
 * - 仅云端同步前：无 OSS 时用会话 BFF 本地地址
 * - 浏览器内将 BFF 地址重写为同站 /api/book-mall 代理，保证 video 带 Cookie
 */
export function resolveJianyingAutoRenderPlaybackUrl(args: {
  videoUrl?: string | null;
  mediaRenderResult?: JianyingMediaRenderResult | null;
  bookMallBase?: string | null;
}): string {
  const session = trimUrl(args.videoUrl);
  const persisted = trimUrl(args.mediaRenderResult?.downloadUrl);
  const expired = isJianyingMediaRenderDownloadExpired(
    args.mediaRenderResult?.expiresAt,
  );

  let chosen = "";
  if (persisted && !expired) {
    chosen = persisted;
  } else if (session && isMediaRenderSessionLocalUrl(session)) {
    chosen = session;
  } else if (persisted) {
    chosen = persisted;
  } else {
    chosen = session;
  }

  if (!chosen) return "";

  if (
    typeof window !== "undefined" &&
    args.bookMallBase?.trim() &&
    isMediaRenderSessionLocalUrl(chosen)
  ) {
    const pathMatch = chosen.match(
      /\/api\/canvas\/media\/render\/[^/?#]+\/download(?:[/?#]|$)/,
    );
    if (pathMatch) {
      const path = pathMatch[0].replace(/[/?#].*$/, "");
      return resolveBookMallBrowserRequest(args.bookMallBase.trim(), path, {
        method: "GET",
      }).url;
    }
  }

  return chosen;
}

/** autosave 前：勿将 BFF 本地 /download 写入 videoUrl（OSS 已有时对齐 downloadUrl） */
export function normalizeJianyingAutoRenderNodeDataForPersist(
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (data.mediaRenderResult == null || typeof data.mediaRenderResult !== "object") {
    return data;
  }
  const result = data.mediaRenderResult as JianyingMediaRenderResult;
  const oss = trimUrl(result.downloadUrl);
  if (!oss) return data;

  const video = trimUrl(typeof data.videoUrl === "string" ? data.videoUrl : "");
  if (!video || !isMediaRenderSessionLocalUrl(video)) return data;

  const next = { ...data, videoUrl: oss };
  if (!trimUrl(typeof data.posterUrl === "string" ? data.posterUrl : "")) {
    const poster = trimUrl(result.posterUrl);
    if (poster) next.posterUrl = poster;
  }
  return next;
}
