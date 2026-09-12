import { prisma } from "@/lib/prisma";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ensurePublicImageUrl } from "@/lib/image-local-edit/image-url";
import { OUTPAINT_API_BASE_PARAMETERS } from "./constants";
import { invokeCanvasImageOutpaint } from "./gateway-invoke";

async function rehostResultUrl(userId: string, url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载扩图结果失败 HTTP ${res.status}`);
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

export type CanvasOutpaintOffsets = {
  left_offset: number;
  right_offset: number;
  top_offset: number;
  bottom_offset: number;
};

export function buildOutpaintParametersFromOffsets(
  offsets: CanvasOutpaintOffsets,
): Record<string, unknown> {
  const params: Record<string, unknown> = {};
  for (const key of [
    "left_offset",
    "right_offset",
    "top_offset",
    "bottom_offset",
  ] as const) {
    const v = Math.max(0, Math.round(offsets[key]));
    if (v > 0) params[key] = v;
  }
  if (Object.keys(params).length === 0) {
    throw new Error("请向外拖动扩图框后再生成");
  }
  return { ...OUTPAINT_API_BASE_PARAMETERS, ...params };
}

export async function runCanvasImageOutpaint(opts: {
  userId: string;
  sourceImageUrl: string;
  offsets: CanvasOutpaintOffsets;
  clientPage?: string;
}): Promise<{ imageUrls: string[]; logId: string; creditsCharged?: number | null }> {
  const imageUrl = await ensurePublicImageUrl(opts.userId, opts.sourceImageUrl);
  const parameters = buildOutpaintParametersFromOffsets(opts.offsets);
  const gatewayResult = await invokeCanvasImageOutpaint({
    userId: opts.userId,
    imageUrl,
    parameters,
    clientPage: opts.clientPage,
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
