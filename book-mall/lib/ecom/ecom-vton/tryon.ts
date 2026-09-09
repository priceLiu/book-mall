import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ensureDashscopeImageUrl } from "@/lib/ecom/ecom-dashscope-image-normalize";
import { prepareVtonGarmentUrlForTryon } from "@/lib/ecom/ecom-vton/garment-tryon-prepare";
import { VtonTryonCancelledError, vtonInterruptibleDelay } from "@/lib/ecom/ecom-vton/cancel";
import {
  parseVtonFullSetGarmentFromImage,
  parseVtonGarmentFromPersonImage,
  type VtonGarmentParseCache,
} from "@/lib/ecom/ecom-vton/garment-parsing";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import type {
  VtonGarmentMode,
  VtonLookKind,
  VtonTryonProgress,
} from "@/lib/ecom/ecom-vton/types";
import {
  ECOM_VTON_TRYON_ACTION,
  ECOM_VTON_TRYON_MODEL,
  ECOM_VTON_TOOL_KEY,
} from "@/lib/ecom/ecom-vton/types";
import { dashscopeExtractTaskImageUrl } from "@/lib/gateway/dashscope-client";
import {
  toolGwCreateDashscopeJob,
  toolGwPollDashscope,
} from "@/lib/gateway/tool-gateway-client";

export { ECOM_VTON_TRYON_MODEL as OUTFIT_TRYON_MODEL, VtonTryonCancelledError };

const POLL_INTERVAL_MS = 2800;
const POLL_MAX = 90;

function progressNow(
  phase: VtonTryonProgress["phase"],
  label: string,
  pollCount?: number,
): VtonTryonProgress {
  return {
    phase,
    label,
    pollCount,
    updatedAt: new Date().toISOString(),
  };
}

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

async function resolveTryonGarmentUrls(opts: {
  userId: string;
  consumerToolKey: string;
  projectId: string;
  personImageUrl: string;
  lookKind: VtonLookKind;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  garmentParseCache?: VtonGarmentParseCache;
  onProgress?: (progress: VtonTryonProgress) => void | Promise<void>;
}): Promise<{ topGarmentUrl?: string; bottomGarmentUrl?: string }> {
  const top = opts.topGarmentUrl?.trim();
  const bottom = opts.bottomGarmentUrl?.trim();

  if (opts.lookKind === "top_only") {
    if (!top) throw new Error("缺少上装参考图");
    await opts.onProgress?.(progressNow("submitting", "识别模特原下装…"));
    const parsedBottom = await parseVtonGarmentFromPersonImage({
      userId: opts.userId,
      personImageUrl: opts.personImageUrl,
      clothesType: "lower",
      projectId: opts.projectId,
      consumerToolKey: opts.consumerToolKey,
      cache: opts.garmentParseCache,
    });
    return { topGarmentUrl: top, bottomGarmentUrl: parsedBottom };
  }

  if (opts.lookKind === "bottom_only") {
    if (!bottom) throw new Error("缺少下装参考图");
    await opts.onProgress?.(progressNow("submitting", "识别模特原上装…"));
    const parsedTop = await parseVtonGarmentFromPersonImage({
      userId: opts.userId,
      personImageUrl: opts.personImageUrl,
      clothesType: "upper",
      projectId: opts.projectId,
      consumerToolKey: opts.consumerToolKey,
      cache: opts.garmentParseCache,
    });
    return { topGarmentUrl: parsedTop, bottomGarmentUrl: bottom };
  }

  if (opts.lookKind === "full_set") {
    const setUrl = top?.trim();
    if (!setUrl) throw new Error("缺少套装参考图");
    await opts.onProgress?.(progressNow("submitting", "识别套装上装与下装…"));
    return parseVtonFullSetGarmentFromImage({
      userId: opts.userId,
      garmentImageUrl: setUrl,
      projectId: opts.projectId,
      consumerToolKey: opts.consumerToolKey,
      cache: opts.garmentParseCache,
    });
  }

  return { topGarmentUrl: top, bottomGarmentUrl: bottom };
}

export async function runEcomVtonTryOn(opts: {
  userId: string;
  consumerToolKey: string;
  projectId: string;
  personImageUrl: string;
  lookKind: VtonLookKind;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  /** 批量试衣时复用分割结果 */
  garmentParseCache?: VtonGarmentParseCache;
  /** 批量试衣已在 resolve 阶段完成 tighten + dashscope 规范化 */
  garmentUrlsPrepared?: boolean;
  /** @deprecated 使用 lookKind */
  garmentMode?: VtonGarmentMode;
  onProgress?: (progress: VtonTryonProgress) => void | Promise<void>;
  shouldCancel?: () => boolean | Promise<boolean>;
}): Promise<string> {
  const personRaw = opts.personImageUrl.trim();
  if (!personRaw) throw new Error("缺少模特全身照");
  if (!opts.topGarmentUrl?.trim() && !opts.bottomGarmentUrl?.trim()) {
    throw new Error("缺少服装参考图");
  }

  await opts.onProgress?.(progressNow("submitting", "准备试衣图片…"));

  const personNorm = await ensureDashscopeImageUrl({ userId: opts.userId, imageUrl: personRaw });
  const personImageUrl = personNorm.url;

  const resolved = await resolveTryonGarmentUrls({
    userId: opts.userId,
    consumerToolKey: opts.consumerToolKey,
    projectId: opts.projectId,
    personImageUrl,
    lookKind: opts.lookKind,
    topGarmentUrl: opts.topGarmentUrl,
    bottomGarmentUrl: opts.bottomGarmentUrl,
    garmentParseCache: opts.garmentParseCache,
    onProgress: opts.onProgress,
  });

  const prepareGarment = async (garmentUrl: string | undefined) => {
    const raw = garmentUrl?.trim();
    if (!raw) return null;
    if (opts.garmentUrlsPrepared) return raw;
    return prepareVtonGarmentUrlForTryon({ userId: opts.userId, garmentUrl: raw });
  };

  const [topNorm, bottomNorm] = await Promise.all([
    prepareGarment(resolved.topGarmentUrl),
    prepareGarment(resolved.bottomGarmentUrl),
  ]);
  const topGarmentUrl = topNorm?.url;
  const bottomGarmentUrl = bottomNorm?.url;
  if (!topGarmentUrl && !bottomGarmentUrl) throw new Error("缺少服装参考图");
  if (opts.lookKind === "full_set" && (!topGarmentUrl || !bottomGarmentUrl)) {
    throw new Error("套装试衣需要同时识别上装与下装，请换一张包含完整上下装的套装参考图");
  }
  if (opts.lookKind === "two_piece" && (!topGarmentUrl || !bottomGarmentUrl)) {
    throw new Error("上下装试衣缺少上装或下装参考图");
  }

  await opts.onProgress?.(progressNow("submitting", "提交 AI 试衣任务…"));

  const clientPage = ecomClientPage(opts.userId, opts.projectId, opts.consumerToolKey);
  const { taskId, logId } = await toolGwCreateDashscopeJob(opts.userId, {
    kind: "tryon",
    model: ECOM_VTON_TRYON_MODEL,
    personImageUrl,
    topGarmentUrl,
    bottomGarmentUrl,
    clientPage: `${clientPage}/tryon`,
  });

  for (let i = 0; i < POLL_MAX; i++) {
    if (await opts.shouldCancel?.()) throw new VtonTryonCancelledError();
    if (i > 0) await vtonInterruptibleDelay(POLL_INTERVAL_MS, opts.shouldCancel);
    await opts.onProgress?.(progressNow("polling", "AI 试衣生成中…", i + 1));
    const output = await toolGwPollDashscope(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    const status = String(output.task_status ?? "").toUpperCase();
    if (status === "SUCCEEDED" || status === "SUCCESS") {
      const ephemeralUrl = dashscopeExtractTaskImageUrl(output as Record<string, unknown>);
      if (!ephemeralUrl?.trim()) throw new Error("试衣完成但未返回图片");
      await opts.onProgress?.(progressNow("persisting", "转存试衣成片…"));
      const ossUrl = await persistTryOnImageToUserOss(opts.userId, ephemeralUrl.trim());
      await opts.onProgress?.(progressNow("done", "试衣完成"));
      return ossUrl;
    }
    if (status === "FAILED" || status === "CANCELED") {
      const message =
        typeof output.message === "string" && output.message.trim()
          ? output.message.trim()
          : "AI 试衣失败";
      await opts.onProgress?.(progressNow("failed", message));
      throw new Error(message);
    }
  }

  await opts.onProgress?.(progressNow("failed", "AI 试衣超时"));
  throw new Error("AI 试衣超时，请稍后重试");
}
