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

/** 同域链接：在用户点击同步触发，避免 await fetch 后浏览器拦截 download */
export function triggerSameOriginDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // 大文件时部分浏览器会忽略 download 属性；hidden iframe 可触发 Content-Disposition 下载
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.title = "download";
  iframe.src = url;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 120_000);
}

export async function downloadUrlAsFile(url: string, filename: string): Promise<void> {
  if (url.startsWith("/")) {
    triggerSameOriginDownload(url, filename);
    return;
  }
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error(`下载失败 (${res.status})`);
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
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
    triggerSameOriginDownload(url, filename);
    return;
  }
  await downloadUrlAsFile(url, filename);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  triggerSameOriginDownload(dataUrl, filename);
}
