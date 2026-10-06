import { zipSync } from "fflate";

import type { CanvasFlowNode } from "./types";
import { mediaUrlFromNodeData } from "./project-asset-media-url";

export type SelectionMediaItem = {
  nodeId: string;
  url: string;
  label: string;
};

function sanitizeZipEntryName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim().slice(0, 72) || "media";
}

function extFromUrl(url: string, fallback: string): string {
  const path = url.split("?")[0] ?? "";
  const ext = path.split(".").pop()?.toLowerCase();
  if (!ext || ext.length > 5) return fallback;
  return ext;
}

/** 框选节点内可下载的图片 / 视频 URL（去重） */
export function collectSelectionMediaItems(
  nodes: CanvasFlowNode[],
): SelectionMediaItem[] {
  const out: SelectionMediaItem[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (node.type === "group") continue;
    const url = mediaUrlFromNodeData((node.data ?? {}) as Record<string, unknown>);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const d = node.data as { label?: string; title?: string };
    out.push({
      nodeId: node.id,
      url,
      label: d.label?.trim() || d.title?.trim() || node.type || node.id,
    });
  }
  return out;
}

/** 将框选媒体打包为 zip 并触发浏览器下载 */
export async function downloadSelectionMediaAsZip(
  items: SelectionMediaItem[],
  zipBasename: string,
): Promise<{ ok: number; failed: number }> {
  if (!items.length) return { ok: 0, failed: 0 };

  const files: Record<string, Uint8Array> = {};
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    try {
      const res = await fetch(item.url, { mode: "cors" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = new Uint8Array(await res.arrayBuffer());
      const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(item.url);
      const ext = extFromUrl(item.url, isVideo ? "mp4" : "png");
      const base = sanitizeZipEntryName(item.label);
      const entry = `${String(i + 1).padStart(2, "0")}-${base}.${ext}`;
      files[entry] = buf;
      ok += 1;
    } catch {
      failed += 1;
    }
  }

  if (ok === 0) {
    throw new Error("无法拉取媒体文件，请检查网络或 OSS 跨域配置");
  }

  const zipped = zipSync(files, { level: 0 });
  const blob = new Blob([zipped], { type: "application/zip" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = `${sanitizeZipEntryName(zipBasename)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);

  return { ok, failed };
}
