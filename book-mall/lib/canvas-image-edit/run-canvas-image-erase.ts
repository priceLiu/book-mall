import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ensurePublicImageUrl } from "@/lib/image-local-edit/image-url";
import { invokeCanvasImageErase } from "./gateway-invoke";

async function rehostResultUrl(userId: string, url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载擦除结果失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
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

export async function runCanvasImageErase(opts: {
  userId: string;
  sourceImageUrl: string;
  maskDataUrl: string;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string; creditsCharged?: number | null }> {
  const imageUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageUrl);
  const maskUrl = await ensurePublicImageUrl(opts.userId, opts.maskDataUrl);
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
