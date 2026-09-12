import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ensureAitryonRefinerAlignedUrls } from "@/lib/ecom/ecom-dashscope-image-normalize";
import { vtonInterruptibleDelay } from "@/lib/ecom/ecom-vton/cancel";
import { prepareEcomVtonTryonInputs } from "@/lib/ecom/ecom-vton/tryon";
import type { VtonTryonProgress, VtonTryonRefinerGender } from "@/lib/ecom/ecom-vton/types";
import { ECOM_VTON_REFINER_MODEL } from "@/lib/ecom/ecom-vton/types";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { dashscopeExtractTaskImageUrl } from "@/lib/gateway/dashscope-client";
import {
  toolGwCreateDashscopeJob,
  toolGwPollDashscope,
} from "@/lib/gateway/tool-gateway-client";

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

async function persistRefinedImageToUserOss(userId: string, ephemeralUrl: string): Promise<string> {
  const res = await fetch(ephemeralUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`下载精修成片失败 HTTP ${res.status}`);
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

export async function runEcomVtonTryonRefine(opts: {
  userId: string;
  consumerToolKey: string;
  projectId: string;
  personImageUrl: string;
  lookKind: Parameters<typeof prepareEcomVtonTryonInputs>[0]["lookKind"];
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  coarseImageUrl: string;
  gender: VtonTryonRefinerGender;
  onProgress?: (progress: VtonTryonProgress) => void | Promise<void>;
}): Promise<string> {
  const coarseRaw = opts.coarseImageUrl.trim();
  if (!coarseRaw) throw new Error("缺少试衣成片");

  const prepared = await prepareEcomVtonTryonInputs({
    userId: opts.userId,
    consumerToolKey: opts.consumerToolKey,
    projectId: opts.projectId,
    personImageUrl: opts.personImageUrl,
    lookKind: opts.lookKind,
    topGarmentUrl: opts.topGarmentUrl,
    bottomGarmentUrl: opts.bottomGarmentUrl,
    onProgress: opts.onProgress,
  });

  const topGarmentUrl = prepared.topGarmentUrl?.trim();
  if (!topGarmentUrl) throw new Error("精修缺少上装参考图");

  await opts.onProgress?.(progressNow("submitting", "对齐精修图片尺寸…"));

  const aligned = await ensureAitryonRefinerAlignedUrls({
    userId: opts.userId,
    personImageUrl: prepared.personImageUrl,
    coarseImageUrl: coarseRaw,
  });

  await opts.onProgress?.(progressNow("submitting", "提交试衣精修任务…"));

  const clientPage = ecomClientPage(opts.userId, opts.projectId, opts.consumerToolKey);
  const { taskId, logId } = await toolGwCreateDashscopeJob(opts.userId, {
    kind: "tryon-refiner",
    model: ECOM_VTON_REFINER_MODEL,
    personImageUrl: aligned.personImageUrl,
    topGarmentUrl,
    bottomGarmentUrl: prepared.bottomGarmentUrl,
    coarseImageUrl: aligned.coarseImageUrl,
    gender: opts.gender,
    clientPage: `${clientPage}/tryon-refine`,
  });

  for (let i = 0; i < POLL_MAX; i++) {
    if (i > 0) await vtonInterruptibleDelay(POLL_INTERVAL_MS);
    await opts.onProgress?.(progressNow("polling", "试衣精修中…", i + 1));
    const output = await toolGwPollDashscope(opts.userId, {
      taskId,
      gatewayLogId: logId,
    });
    const status = String(output.task_status ?? "").toUpperCase();
    if (status === "SUCCEEDED" || status === "SUCCESS") {
      const ephemeralUrl = dashscopeExtractTaskImageUrl(output as Record<string, unknown>);
      if (!ephemeralUrl?.trim()) throw new Error("精修完成但未返回图片");
      await opts.onProgress?.(progressNow("persisting", "转存精修成片…"));
      const ossUrl = await persistRefinedImageToUserOss(opts.userId, ephemeralUrl.trim());
      await opts.onProgress?.(progressNow("done", "精修完成"));
      return ossUrl;
    }
    if (status === "FAILED" || status === "CANCELED") {
      const message =
        typeof output.message === "string" && output.message.trim()
          ? output.message.trim()
          : "试衣精修失败";
      await opts.onProgress?.(progressNow("failed", message));
      throw new Error(message);
    }
  }

  await opts.onProgress?.(progressNow("failed", "试衣精修超时"));
  throw new Error("试衣精修超时，请稍后重试");
}
