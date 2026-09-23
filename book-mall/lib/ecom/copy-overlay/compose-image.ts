import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import type { EcomCopyOverlay } from "@private/ecom-copy-overlay";
import { parseEcomCopyOverlay, syncOverlayMainLayerText } from "@private/ecom-copy-overlay";

import { compositeBaseImageWithCopyOverlay } from "@/lib/ecom/detail-page-suite/slot-copy-overlay-render";

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url.trim(), { method: "GET", cache: "no-store" });
  if (!res.ok) throw new Error(`无法下载底图（${res.status}）`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_IMAGE_BYTES) throw new Error("底图过大，请换一张或压缩后重试");
  return buf;
}

/** 通用：底图 + 排版 JSON → OSS PNG（详情页套图 / 画布等共用） */
export async function composeEcomCopyOverlayImage(opts: {
  userId: string;
  baseImageUrl: string;
  overlay: EcomCopyOverlay;
  /** 与 overlay 内 main 层文案同步 */
  syncText?: string;
  exportWidthPx?: number;
}): Promise<{ url: string; overlay: EcomCopyOverlay }> {
  const parsed =
    parseEcomCopyOverlay(opts.overlay) ??
    ({ version: 1 as const, exportWidthPx: 750, layers: [] } satisfies EcomCopyOverlay);
  const exportWidthPx = opts.exportWidthPx ?? parsed.exportWidthPx ?? 750;
  let overlay = opts.syncText?.trim()
    ? syncOverlayMainLayerText(parsed, opts.syncText)
    : parsed;
  overlay = { ...overlay, exportWidthPx, baseImageUrl: opts.baseImageUrl.trim() };

  if (!overlay.layers.some((l) => l.text.trim())) {
    throw new Error("请先填写文案或添加文字层");
  }

  const baseBuf = await fetchImageBuffer(opts.baseImageUrl);
  const composed = await compositeBaseImageWithCopyOverlay({
    baseImage: baseBuf,
    exportWidthPx,
    layers: overlay.layers,
  });
  const url = await uploadCanvasUserBuffer({
    userId: opts.userId,
    buf: composed,
    contentType: "image/png",
    ext: "png",
  });
  return { url, overlay };
}
