import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import { resolveOutfitFusionModelKey } from "@/lib/ecom/ecom-outfit-video-fusion-models";
import { ensureStoryboardRefImagesForWan27 } from "@/lib/ecom/ecom-storyboard-ref-image";
import { resolveStoryboardWan27JobSize } from "@/lib/ecom/ecom-storyboard-gen-params";
import {
  isWan26ImageModel,
  resolveStoryboardDashscopeModel,
} from "@/lib/ecom/ecom-storyboard-image-models";
import {
  ecomGwCreateDashscopeJob,
  ecomGwPollDashscope,
} from "@/lib/gateway/ecom-tool-gateway-client";
import {
  isQwenImage30ProModel,
  isQwenImageEditModel,
} from "@/lib/gateway/qwen-image-edit-proxy";

async function pollFusionImage(userId: string, taskId: string, logId: string): Promise<string> {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2500));
    const polled = await ecomGwPollDashscope(userId, { taskId, gatewayLogId: logId });
    if (polled.status === "SUCCEEDED" && polled.outputUrl) {
      return polled.outputUrl;
    }
    if (polled.status === "FAILED") {
      throw new Error(polled.failMessage ?? "融图失败");
    }
  }
  throw new Error("融图超时，请稍后重试");
}

async function persistFusionImage(userId: string, vendorUrl: string): Promise<string> {
  const res = await fetch(vendorUrl, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`下载融图结果失败 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : "jpg";
  return uploadCanvasUserBuffer({ userId, buf, ext, contentType });
}

/** 模特 + 服装 + 可选场景 多图融合 */
export async function invokeEcomMultiRefImageFusion(opts: {
  userId: string;
  clientPage: string;
  imageUrls: string[];
  prompt: string;
  negativePrompt: string;
  fusionModelKey?: string;
}): Promise<string> {
  const urls = opts.imageUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length < 2) throw new Error("融图至少需要 2 张参考图");

  const modelKey = resolveOutfitFusionModelKey(opts.fusionModelKey);
  const refs = await ensureStoryboardRefImagesForWan27({
    userId: opts.userId,
    urls,
  });

  const promptText = opts.prompt.trim();
  const negative = opts.negativePrompt.trim();

  if (isQwenImageEditModel(modelKey) || isQwenImage30ProModel(modelKey)) {
    const content: Array<{ text: string } | { image: string }> = [
      ...refs.map((url) => ({ image: url })),
      { text: promptText },
    ];
    const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
      kind: "multimodal-image-sync",
      model: modelKey,
      content,
      parameters: {
        size: "768*1344",
        n: 1,
        prompt_extend: isQwenImageEditModel(modelKey),
        watermark: false,
        negative_prompt: negative,
      },
      clientPage: opts.clientPage,
    });
    const vendorUrl = await pollFusionImage(opts.userId, taskId, logId);
    return persistFusionImage(opts.userId, vendorUrl);
  }

  const apiModel = resolveStoryboardDashscopeModel(modelKey);
  const wan26 = isWan26ImageModel(apiModel) || isWan26ImageModel(modelKey);
  const content: Array<{ text: string } | { image: string }> = wan26
    ? [{ text: promptText }, ...refs.map((url) => ({ image: url }))]
    : [...refs.map((url) => ({ image: url })), { text: promptText }];

  const { taskId, logId } = await ecomGwCreateDashscopeJob(opts.userId, {
    kind: "wan27-image",
    model: apiModel,
    content,
    size: resolveStoryboardWan27JobSize({
      wan26,
      refCount: refs.length,
      wan27Size: "768*1344",
    }),
    n: 1,
    contentOrder: wan26 ? "text-first" : "images-first",
    clientPage: opts.clientPage,
  });
  const vendorUrl = await pollFusionImage(opts.userId, taskId, logId);
  return persistFusionImage(opts.userId, vendorUrl);
}
