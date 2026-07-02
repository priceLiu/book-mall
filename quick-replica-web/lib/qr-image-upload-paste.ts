/** 从剪贴板事件提取图片 File（支持多图粘贴） */
export function extractImageFilesFromClipboard(
  event: ClipboardEvent | React.ClipboardEvent,
): File[] {
  const data = "clipboardData" in event ? event.clipboardData : null;
  if (!data) return [];

  const files: File[] = [];
  for (const item of Array.from(data.items)) {
    if (item.kind !== "file") continue;
    if (!item.type.startsWith("image/")) continue;
    const file = item.getAsFile();
    if (file) files.push(file);
  }
  return files;
}

/** 触发浏览器下载远程图片（跨域失败时新开标签页） */
export async function downloadImageUrl(url: string, filename?: string): Promise<void> {
  const name = filename ?? `image-${Date.now()}.jpg`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("fetch failed");
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = name;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(objectUrl);
  } catch {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }
}
