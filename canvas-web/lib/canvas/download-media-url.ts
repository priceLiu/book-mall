/** 画布媒体下载：优先 blob 触发保存，避免跨域直链新开标签闪黑屏 */
export async function downloadMediaUrl(
  url: string,
  filename: string,
): Promise<void> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
}

export function guessMediaDownloadFilename(
  url: string,
  fallback: string,
): string {
  try {
    const base = new URL(url).pathname.split("/").pop();
    if (base && base.includes(".")) return base;
  } catch {
    /* ignore */
  }
  return fallback;
}
