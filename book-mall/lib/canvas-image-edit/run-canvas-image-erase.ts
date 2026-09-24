import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { bboxToMaskPngDataUrl } from "@/lib/image-local-edit/bbox-to-mask";
import { ensurePublicImageUrl } from "@/lib/image-local-edit/image-url";
import { readImagePixelSize } from "@/lib/image-local-edit/normalize-inpaint-mask";
import type { LocalEditBbox } from "@/lib/image-local-edit/types";
import { invokeCanvasImageErase } from "./gateway-invoke";

async function rehostResultUrl(userId: string, url: string): Promise<string> {
  if (!url?.trim()) throw new Error("擦除未返回有效图像");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载擦除结果失败 HTTP ${res.status}`);
  const bytes = await res.arrayBuffer();
  if (!bytes || bytes.byteLength === 0) {
    throw new Error("擦除结果下载为空");
  }
  const buf = Buffer.from(bytes);
  const contentType = res.headers.get("content-type") ?? "image/png";
  const ext = contentType.includes("jpeg") ? "jpg" : "png";
  return uploadCanvasUserBuffer({
    userId,
    ext,
    buf,
    contentType: ext === "jpg" ? "image/jpeg" : "image/png",
  });
}

async function readCreditsCharged(logId: string): Promise<number | null> {
  const log = await prisma.gatewayRequestLog.findUnique({
    where: { id: logId },
    select: { creditsCharged: true },
  });
  if (log?.creditsCharged == null) return null;
  return Number(log.creditsCharged);
}

async function resolveEraseMaskDataUrl(opts: {
  sourceImageUrl: string;
  maskDataUrl?: string;
  bbox?: LocalEditBbox;
}): Promise<string> {
  const mask = opts.maskDataUrl?.trim() ?? "";
  if (mask) return mask;
  if (opts.bbox) {
    const { width, height } = await readImagePixelSize(opts.sourceImageUrl);
    return bboxToMaskPngDataUrl(opts.bbox, width, height);
  }
  throw new Error("请涂抹或框选需要擦除的区域");
}

export async function runCanvasImageErase(opts: {
  userId: string;
  sourceImageUrl: string;
  maskDataUrl?: string;
  bbox?: LocalEditBbox;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string; creditsCharged?: number | null }> {
  const maskDataUrl = await resolveEraseMaskDataUrl(opts);
  const imageUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageUrl);
  const maskUrl = await ensurePublicImageUrl(opts.userId, maskDataUrl);
  const gatewayResult = await invokeCanvasImageErase({
    userId: opts.userId,
    imageUrl,
    maskUrl,
    clientPage: opts.clientPage,
    fastMode: true,
  });
  const imageUrls = await Promise.all(
    gatewayResult.imageUrls.map((u) => rehostResultUrl(opts.userId, u)),
  );
  const creditsCharged = await readCreditsCharged(gatewayResult.logId);
  return {
    imageUrls,
    logId: gatewayResult.logId,
    creditsCharged,
  };
}
