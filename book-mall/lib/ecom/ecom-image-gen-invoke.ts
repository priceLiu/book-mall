import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { buildKieImageCreateArgs } from "@/lib/canvas/providers/kie";
import {
  ecomRatioToImageSize,
  type EcomImageRatio,
} from "@/lib/ecom/ecom-platform-spec";
import { resolveKlingV3Resolution } from "@/lib/ecom/ecom-storyboard-gen-params";
import { isDashscopeMultimodalImageGenModel, isZImageTurboModel } from "@/lib/gateway/qwen-image-edit-proxy";
import {
  isStoryboardDashscopeImageModel,
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKieModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import {
  ecomGwCreateDashscopeJob,
  ecomGwCreateKieJob,
  ecomGwPollDashscope,
  ecomGwPollKie,
} from "@/lib/gateway/ecom-tool-gateway-client";

/**
 * 电商工具箱统一生图下发：按 modelKey 选厂商分支、轮询、把成图转存到自有 OSS。
 *
 * 主图 / 详情页 / 手伴创作共用同一条链路；新增产线不要复制厂商分支。
 */

/** 可灵只接受三种比例，取数值上最接近的一档 */
function toKlingAspect(ratio: EcomImageRatio): "16:9" | "9:16" | "1:1" {
  const value = { "1:1": 1, "3:4": 0.75, "4:5": 0.8, "16:9": 16 / 9 }[ratio];
  const candidates: Array<{ key: "16:9" | "9:16" | "1:1"; value: number }> = [
    { key: "16:9", value: 16 / 9 },
    { key: "1:1", value: 1 },
    { key: "9:16", value: 9 / 16 },
  ];
  return candidates.reduce((best, cur) =>
    Math.abs(cur.value - value) < Math.abs(best.value - value) ? cur : best,
  ).key;
}

function isTransientPollError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg === "fetch failed" ||
    msg.includes("网络异常") ||
    msg.includes("ECONNRESET") ||
    msg.includes("ETIMEDOUT")
  );
}

async function pollDashscopeImage(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    let polled: Awaited<ReturnType<typeof ecomGwPollDashscope>>;
    try {
      polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    } catch (e) {
      if (isTransientPollError(e) && i < 59) continue;
      throw e instanceof Error ? e : new Error(String(e));
    }
    if (polled.status === "SUCCEEDED" && polled.outputUrl) return polled.outputUrl;
    if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "生图任务失败");
  }
  throw new Error("生图超时，请稍后重试");
}

async function pollKieImage(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const polled = await ecomGwPollKie(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) return polled.outputUrl;
    if (polled.status === "FAILED") throw new Error(polled.failMessage ?? "生图任务失败");
  }
  throw new Error("生图超时，请稍后重试");
}

async function downloadAndUpload(userId: string, imageUrl: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(imageUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      msg === "fetch failed" ? "下载生成图失败：网络中断，请重试" : `下载生成图失败：${msg}`,
    );
  }
  if (!res.ok) throw new Error(`下载生成图失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return uploadCanvasUserBuffer({ userId, ext: "png", buf, contentType: "image/png" });
}

async function pollMultimodalSyncImage(
  userId: string,
  taskId: string,
  logId: string,
): Promise<string> {
  return pollDashscopeImage(userId, taskId, logId);
}

async function generateMultimodalSyncImage(opts: {
  userId: string;
  modelKey: string;
  prompt: string;
  ratio: EcomImageRatio;
  refImageUrls: string[];
  toolKey: string;
}): Promise<string> {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);
  const refs =
    !isZImageTurboModel(opts.modelKey) && opts.refImageUrls.length > 0
      ? await ensureStoryboardRefImagesForWan27({
          userId: opts.userId,
          urls: opts.refImageUrls.slice(0, 3),
        })
      : [];
  const content: Array<{ text: string } | { image: string }> =
    refs.length > 0
      ? [...refs.map((url) => ({ image: url })), { text: opts.prompt }]
      : [{ text: opts.prompt }];
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "multimodal-image-sync",
    model: opts.modelKey,
    content,
    parameters: {
      size: ecomRatioToImageSize(opts.ratio),
      n: 1,
      prompt_extend: !isZImageTurboModel(opts.modelKey),
      watermark: false,
    },
    clientPage,
  });
  const vendorUrl = await pollMultimodalSyncImage(opts.userId, taskId, logId);
  return downloadAndUpload(opts.userId, vendorUrl);
}

export async function generateEcomImage(opts: {
  userId: string;
  modelKey: string;
  prompt: string;
  ratio: EcomImageRatio;
  refImageUrls: string[];
  /** Gateway clientPage 里的计费 toolKey（含 action 后缀） */
  toolKey: string;
}): Promise<string> {
  const prompt = String(opts.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("生图 Prompt 为空，请先完成视觉分析");
  }
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);

  if (isDashscopeMultimodalImageGenModel(opts.modelKey)) {
    return generateMultimodalSyncImage(opts);
  }

  if (isStoryboardKieImageModel(opts.modelKey)) {
    const { model, input } = buildKieImageCreateArgs({
      modelKey: resolveStoryboardKieModel(opts.modelKey),
      prompt,
      imageUrls: opts.refImageUrls.slice(0, 8),
      params: {
        aspect_ratio: opts.ratio,
        resolution: "2K",
        output_format: "png",
      },
    });
    const { taskId, logId } = await ecomGwCreateKieJob(opts.userId, {
      model,
      input,
      clientPage,
    });
    const vendorUrl = await pollKieImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  if (isStoryboardKlingImageModel(opts.modelKey)) {
    const refs = await ensureStoryboardRefImagesForWan27({
      userId: opts.userId,
      urls: opts.refImageUrls.slice(0, 10),
    });
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "kling-v3-image",
      model: resolveStoryboardKlingModel(opts.modelKey),
      content: [...refs.map((url) => ({ image: url })), { text: prompt }],
      aspectRatio: toKlingAspect(opts.ratio),
      resolution: resolveKlingV3Resolution(),
      n: 1,
      clientPage,
    });
    const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  const apiModel = resolveStoryboardDashscopeModel(opts.modelKey);
  const size = ecomRatioToImageSize(opts.ratio);

  if (opts.refImageUrls.length === 0) {
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "wanx",
      model: apiModel,
      prompt,
      n: 1,
      size,
      clientPage,
    });
    const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(opts.modelKey);
  const refs = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls: opts.refImageUrls,
  });
  const content: Array<{ text: string } | { image: string }> = wan26
    ? [{ text: prompt }, ...refs.map((url) => ({ image: url }))]
    : [...refs.map((url) => ({ image: url })), { text: prompt }];

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wan27-image",
    model: apiModel,
    content,
    size: wan26 ? undefined : size,
    n: 1,
    contentOrder: wan26 ? "text-first" : "images-first",
    clientPage,
  });
  const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
  return downloadAndUpload(opts.userId, vendorUrl);
}

/**
 * 是否为真正支持参考图（图生图 / 多图参考）的生图模型。
 *
 * 手伴创作全流程靠「基准主形象作参考图」锁一致性，纯文生图模型必须挡在选择器外。
 */
export function isRefCapableEcomImageModel(modelKey: string): boolean {
  const key = modelKey.trim().toLowerCase();
  if (isStoryboardKieImageModel(key)) return true;
  if (isStoryboardKlingImageModel(key)) return true;
  if (isDashscopeMultimodalImageGenModel(key)) {
    return !isZImageTurboModel(key);
  }
  // wanx* 与 *-t2i 为纯文生图；wan2.6-image / wan2.7-image 系支持多图参考
  if (key.includes("wanx") || key.endsWith("-t2i")) return false;
  return key.startsWith("wan2.6-image") || key.startsWith("wan2.7-image");
}
