/** 触发浏览器下载媒体 URL（OSS 跨域时回退新窗口） */
export async function downloadMediaUrl(url: string, filename: string): Promise<void> {
  const safeName = filename.replace(/[^\w\u4e00-\u9fff.-]+/g, "_").slice(0, 120) || "download";
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = safeName;
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.click();
  }
}

export function mediaDownloadFilename(title: string | null | undefined, kind: string, url: string): string {
  const base = (title?.trim() || "asset").slice(0, 80);
  const extFromUrl = url.match(/\.(jpe?g|png|webp|gif|mp4|webm)(\?|$)/i)?.[1]?.toLowerCase();
  const ext =
    extFromUrl ??
    (kind === "video" ? "mp4" : "jpg");
  return `${base}.${ext}`;
}
