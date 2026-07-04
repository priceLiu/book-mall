function safeFilename(title: string): string {
  return title.trim().replace(/[/\\?%*:|"<>]/g, "_").slice(0, 80) || "marble-world";
}

function extFromUrl(url: string, fallback: string): string {
  const path = url.split("?")[0] ?? url;
  const dot = path.lastIndexOf(".");
  if (dot >= 0) {
    const ext = path.slice(dot + 1).toLowerCase();
    if (/^[a-z0-9]{2,5}$/.test(ext)) return ext;
  }
  return fallback;
}

function clickDownloadLink(href: string, filename: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/** 同域链接：在用户点击同步触发 <a download>，避免 await fetch 后浏览器拦截 */
export function triggerSameOriginDownload(url: string, filename: string): void {
  clickDownloadLink(url, filename);
  // 大文件兜底：延迟 iframe，避免与 <a> 同时拉流导致主线程长时间阻塞
  window.setTimeout(() => {
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.title = "download";
    iframe.src = url;
    document.body.appendChild(iframe);
    window.setTimeout(() => iframe.remove(), 120_000);
  }, 900);
}

/** 异步触发同域下载，先让 UI（快门 / Toast）完成一帧渲染 */
export function scheduleSameOriginDownload(url: string, filename: string): void {
  window.requestAnimationFrame(() => {
    triggerSameOriginDownload(url, filename);
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const blobUrl = URL.createObjectURL(blob);
  clickDownloadLink(blobUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  if (url.startsWith("/")) {
    scheduleSameOriginDownload(url, filename);
    return;
  }
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`下载失败 (${res.status})`);
  const blob = await res.blob();
  downloadBlob(blob, filename);
}

export async function downloadWorldSpz(args: {
  title: string;
  worldId: string;
  spzUrl: string | null | undefined;
}): Promise<void> {
  const url = args.spzUrl?.trim();
  if (!url) throw new Error("暂无可下载的 3D 资产");
  const ext = extFromUrl(url, "spz");
  const filename = `${safeFilename(args.title)}-${args.worldId.slice(0, 8)}.${ext}`;
  if (url.startsWith("/")) {
    scheduleSameOriginDownload(url, filename);
    return;
  }
  await downloadUrlAsFile(url, filename);
}

/** @deprecated 大 data URL 会阻塞主线程；请改用 downloadBlob */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  clickDownloadLink(dataUrl, filename);
}
