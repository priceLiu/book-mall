import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import type { VtonGarmentMode, VtonTryonProgress } from "@/lib/ecom/ecom-vton/types";
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

export { ECOM_VTON_TRYON_MODEL as OUTFIT_TRYON_MODEL };

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

export async function runEcomVtonTryOn(opts: {
  userId: string;
  consumerToolKey: string;
  projectId: string;
  personImageUrl: string;
  lookKind: import("@/lib/ecom/ecom-vton/types").VtonLookKind;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  /** @deprecated 使用 lookKind */
  garmentMode?: import("@/lib/ecom/ecom-vton/types").VtonGarmentMode;
  onProgress?: (progress: VtonTryonProgress) => void | Promise<void>;
}): Promise<string> {
  const personImageUrl = opts.personImageUrl.trim();
  const topGarmentUrl = opts.topGarmentUrl?.trim();
  const bottomGarmentUrl = opts.bottomGarmentUrl?.trim();
  if (!personImageUrl) throw new Error("缺少模特全身照");
  if (!topGarmentUrl && !bottomGarmentUrl) throw new Error("缺少服装参考图");

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
    if (i > 0) await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    await opts.onProgress?.(
      progressNow("polling", `AI 试衣生成中…（${i + 1}/${POLL_MAX}）`, i + 1),
    );
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
