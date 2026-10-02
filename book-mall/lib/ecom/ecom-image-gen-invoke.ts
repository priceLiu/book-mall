import { randomUUID } from "crypto";

import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { fetchEcomVendorImageBuffer } from "@/lib/ecom/ecom-vendor-image-download";
import { buildKieImageCreateArgs, isKieGptImageModelKey } from "@/lib/canvas/providers/kie";
import type { EcomImageRatio } from "@/lib/ecom/ecom-platform-spec";
import {
  resolveEcomGeneratePixelSize,
  resolveKlingV3Resolution,
  resolveStoryboardWan27JobSize,
} from "@/lib/ecom/ecom-storyboard-gen-params";
import { isDashscopeMultimodalImageGenModel, isQwenImageEditModel, isZImageTurboModel } from "@/lib/gateway/qwen-image-edit-proxy";
import {
  assertEcomStoryboardImageEditRefs,
  ecomStoryboardImageEditMaxRefs,
} from "@/lib/ecom/ecom-storyboard-image-edit";
import {
  isStoryboardDashscopeImageModel,
  isStoryboardKieImageModel,
  isStoryboardKlingImageModel,
  isWan26ImageModel,
  resolveKieEcomImageModelKey,
  resolveStoryboardDashscopeModel,
  resolveStoryboardKlingModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import { getImageGenMaxRefs } from "@/lib/ecom/ecom-product-design-ref-rules";
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
function toKlingAspect(ratio: EcomImageRatio | "9:16"): "16:9" | "9:16" | "1:1" {
  if (ratio === "9:16") return "9:16";
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
  const vendor = imageUrl.trim();
  try {
    const buf = await fetchEcomVendorImageBuffer(vendor);
    return uploadCanvasUserBuffer({ userId, ext: "png", buf, contentType: "image/png" });
  } catch (e) {
    // nano-banana-pro / KIE 等厂商 HTTPS 成图可先展示；OSS 转存失败时不丢图
    if (/^https?:\/\//i.test(vendor)) {
      console.error("[ecom] vendor image OSS transfer failed, using vendor URL", e);
      return vendor;
    }
    throw e;
  }
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
  negativePrompt?: string;
  promptExtend?: boolean;
  ratio: EcomImageRatio | "9:16";
  imageSize?: string;
  refImageUrls: string[];
  toolKey: string;
}): Promise<string> {
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);
  const refs =
    !isZImageTurboModel(opts.modelKey) && opts.refImageUrls.length > 0
      ? await ensureStoryboardRefImagesForWan27({
          userId: opts.userId,
          urls: opts.refImageUrls.slice(0, ecomStoryboardImageEditMaxRefs(opts.modelKey)),
        })
      : [];
  assertEcomStoryboardImageEditRefs(opts.modelKey, refs.length);
  const content: Array<{ text: string } | { image: string }> =
    refs.length > 0
      ? [...refs.map((url) => ({ image: url })), { text: opts.prompt }]
      : [{ text: opts.prompt }];
  const pixelSize = resolveEcomGeneratePixelSize({
    modelKey: opts.modelKey,
    ratio: opts.ratio,
    imageSize: opts.imageSize,
  });
  const negativePrompt = opts.negativePrompt?.trim();
  const defaultPromptExtend = isQwenImageEditModel(opts.modelKey)
    ? true
    : !isZImageTurboModel(opts.modelKey);
  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "multimodal-image-sync",
    model: opts.modelKey,
    content,
    parameters: {
      size: pixelSize,
      n: 1,
      prompt_extend: opts.promptExtend ?? defaultPromptExtend,
      watermark: false,
      ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
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
  negativePrompt?: string;
  /** 关闭时可避免厂商扩写覆盖精细 Prompt（如头像扩全身） */
  promptExtend?: boolean;
  ratio: EcomImageRatio | "9:16";
  /** 像素 size（如 1080*1440）或 KIE 档位 2K/4K */
  imageSize?: string;
  /** wan2.7 有参考图时仍下发竖向 pixel size（头像扩全身等） */
  wan27KeepPixelSizeWithRefs?: boolean;
  refImageUrls: string[];
  /** Gateway clientPage 里的计费 toolKey（含 action 后缀） */
  toolKey: string;
}): Promise<string> {
  const prompt = String(opts.prompt ?? "").trim();
  if (!prompt) {
    throw new Error("生图 Prompt 为空，请先完成视觉分析");
  }
  assertEcomStoryboardImageEditRefs(opts.modelKey, opts.refImageUrls.length);
  const workspaceId = randomUUID().slice(0, 8);
  const clientPage = ecomClientPage(opts.userId, workspaceId, opts.toolKey);

  if (isDashscopeMultimodalImageGenModel(opts.modelKey)) {
    return generateMultimodalSyncImage(opts);
  }

  if (isStoryboardKieImageModel(opts.modelKey) || isKieGptImageModelKey(opts.modelKey)) {
    const kieResolution =
      opts.imageSize?.trim() === "4K"
        ? "4K"
        : opts.imageSize?.trim() === "2K"
          ? "2K"
          : "2K";
    const refUrls =
      opts.refImageUrls.length > 0
        ? await ensureStoryboardRefImagesForWan27({
            userId: opts.userId,
            urls: opts.refImageUrls
              .filter((u) => /^https?:\/\//i.test(u.trim()))
              .slice(0, Math.max(1, getImageGenMaxRefs(opts.modelKey))),
          })
        : [];
    const { model, input } = buildKieImageCreateArgs({
      modelKey: resolveKieEcomImageModelKey(opts.modelKey),
      prompt,
      imageUrls: refUrls,
      params: {
        aspect_ratio: opts.ratio,
        resolution: kieResolution,
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
      resolution: resolveKlingV3Resolution({ imageSize: opts.imageSize }),
      n: 1,
      clientPage,
    });
    const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
    return downloadAndUpload(opts.userId, vendorUrl);
  }

  const apiModel = resolveStoryboardDashscopeModel(opts.modelKey);
  const size = resolveEcomGeneratePixelSize({
    modelKey: opts.modelKey,
    ratio: opts.ratio,
    imageSize: opts.imageSize,
  });

  if (opts.refImageUrls.length === 0) {
    if (isStoryboardDashscopeImageModel(opts.modelKey)) {
      const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(opts.modelKey);
      const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
        kind: "wan27-image",
        model: apiModel,
        content: [{ text: prompt }],
        size: resolveStoryboardWan27JobSize({
          wan26,
          refCount: 0,
          wan27Size: size,
        }),
        n: 1,
        contentOrder: "text-first",
        clientPage,
      });
      const vendorUrl = await pollDashscopeImage(opts.userId, taskId, logId);
      return downloadAndUpload(opts.userId, vendorUrl);
    }
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
    size: resolveStoryboardWan27JobSize({
      wan26,
      refCount: refs.length,
      wan27Size: size,
      keepPixelSizeWithRefs: opts.wan27KeepPixelSizeWithRefs,
    }),
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
  if (key === "seedream-4.5" || key.startsWith("seedream-")) return true;
  if (isStoryboardKieImageModel(key)) return true;
  if (key.startsWith("gpt-image")) return true;
  if (isStoryboardKlingImageModel(key)) return true;
  if (isDashscopeMultimodalImageGenModel(key)) {
    return !isZImageTurboModel(key);
  }
  // wanx* 与 *-t2i 为纯文生图；wan2.6-image / wan2.7-image 系支持多图参考
  if (key.includes("wanx") || key.endsWith("-t2i")) return false;
  return key.startsWith("wan2.6-image") || key.startsWith("wan2.7-image");
}
