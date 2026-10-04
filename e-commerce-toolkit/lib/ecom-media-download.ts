/** 浏览器 fetch 用同域代理拉 OSS，避免 CORS（与 hand-craft 拼版 proxy-image 一致） */
export function ecomMediaFetchUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (
    trimmed.startsWith("/api/book-mall/") ||
    trimmed.startsWith("/api/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("data:")
  ) {
    return trimmed;
  }
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return `/api/book-mall/api/sso/tools/ecom/hand-craft/proxy-image?url=${encodeURIComponent(trimmed)}`;
  }
  return trimmed;
}

/** 触发浏览器下载媒体 URL（OSS 经同域代理；失败则回退新开标签） */
export async function downloadMediaUrl(url: string, filename: string): Promise<void> {
  const safeName = filename.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 120) || "download";
  const fetchUrl = ecomMediaFetchUrl(url);
  try {
    const res = await fetch(fetchUrl, { credentials: "include" });
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeName;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function mediaDownloadFilename(
  title: string | null | undefined,
  kind: string,
  url?: string | null,
): string {
  const base = (title?.trim() || "asset").slice(0, 80);
  const extFromUrl = url
    ?.trim()
    .match(/\.(jpe?g|png|webp|gif|mp4|webm)(\?|$)/i)?.[1]
    ?.toLowerCase();
  const ext =
    extFromUrl ??
    (kind === "video" ? "mp4" : "jpg");
  return `${base}.${ext}`;
}
