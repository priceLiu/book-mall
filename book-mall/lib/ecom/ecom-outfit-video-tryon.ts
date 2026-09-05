import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ECOM_OUTFIT_VIDEO_TOOL_KEY,
  type OutfitGarmentMode,
} from "@/lib/ecom/ecom-outfit-video-types";
import { dashscopeExtractTaskImageUrl } from "@/lib/gateway/dashscope-client";
import {
  toolGwCreateDashscopeJob,
  toolGwPollDashscope,
} from "@/lib/gateway/tool-gateway-client";

export const OUTFIT_TRYON_MODEL = "aitryon-plus";

const POLL_INTERVAL_MS = 2800;
const POLL_MAX = 90;

async function persistTryOnImageToUserOss(userId: string, ephemeralUrl: string): Promise<string> {
  const res = await fetch(ephemeralUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`下载试衣成片失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  return uploadCanvasUserBuffer({
    userId,
    buf,
    ext,
    contentType,
  });
}

export async function runEcomOutfitVideoTryOn(opts: {
  userId: string;
  projectId: string;
  personImageUrl: string;
  garmentMode: OutfitGarmentMode;
  topGarmentUrl: string;
  bottomGarmentUrl?: string;
}): Promise<string> {
  const personImageUrl = opts.personImageUrl.trim();
  const topGarmentUrl = opts.topGarmentUrl.trim();
  if (!personImageUrl) throw new Error("缺少模特全身照");
  if (!topGarmentUrl) throw new Error("缺少服装参考图");

  const clientPage = ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY);
  const { taskId, logId } = await toolGwCreateDashscopeJob(opts.userId, {
    kind: "tryon",
    model: OUTFIT_TRYON_MODEL,
    personImageUrl,
    topGarmentUrl,
    bottomGarmentUrl:
      opts.garmentMode === "two_piece" ? opts.bottomGarmentUrl?.trim() || undefined : undefined,
    clientPage: `${clientPage}/tryon`,
  });

  for (let i = 0; i < POLL_MAX; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const output = await toolGwPollDashscope(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    const status = String(output.task_status ?? "").toUpperCase();
    if (status === "SUCCEEDED" || status === "SUCCESS") {
      const ephemeralUrl = dashscopeExtractTaskImageUrl(output as Record<string, unknown>);
      if (!ephemeralUrl?.trim()) throw new Error("试衣完成但未返回图片");
      return persistTryOnImageToUserOss(opts.userId, ephemeralUrl.trim());
    }
    if (status === "FAILED" || status === "CANCELED") {
      const message =
        typeof output.message === "string" && output.message.trim()
          ? output.message.trim()
          : "AI 试衣失败";
      throw new Error(message);
    }
  }

  throw new Error("AI 试衣超时，请稍后重试");
}
