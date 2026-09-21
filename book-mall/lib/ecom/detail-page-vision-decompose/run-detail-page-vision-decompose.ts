import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { z } from "zod";

import { DETAIL_PAGE_VISION_DECOMPOSE_FENCE } from "./constants";
import {
  buildDetailPageVisionDecomposeSystem,
  buildDetailPageVisionDecomposeUserText,
} from "./prompts";
import {
  extractFenceJson,
  normalizeDetailPageVisionDecompose,
  type DetailPageVisionDecompose,
} from "./schemas";

function isGatewayOrTransportError(e: unknown): boolean {
  if (e instanceof z.ZodError) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /未返回有效 JSON|校验失败|顺序|module_id|schemaVersion|不支持|围栏/.test(msg)
  ) {
    return false;
  }
  return true;
}

export type RunDetailPageVisionDecomposeOpts = {
  userId: string;
  /** 参考详情长图 OSS URL（至少 1 张） */
  referenceImageUrls: string[];
  visionModelKey?: string;
  /** Gateway clientPage 第三段，如 ecom-toolkit__detail-page-suite-replica__decompose */
  clientPageAction: string;
  /** 工作区 id（项目 id / 画布 id） */
  workspaceId: string;
  productDesc?: string | null;
};

/**
 * 详情页长图视觉拆解（可复用：复刻、画布等）。
 * 仅使用参考长图，不传用户产品/模特。
 */
export async function runDetailPageVisionDecompose(
  opts: RunDetailPageVisionDecomposeOpts,
): Promise<DetailPageVisionDecompose> {
  const urls = opts.referenceImageUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) {
    throw new Error("请先上传参考详情长图");
  }

  const modelKey = opts.visionModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const max = getVisionMaxInputImages(modelKey);
  const imageUrls = urls.slice(0, max);

  const parts: CanvasChatContentPart[] = [
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text" as const,
      text: buildDetailPageVisionDecomposeUserText({ productDesc: opts.productDesc }),
    },
  ];

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildDetailPageVisionDecomposeSystem() },
          { role: "user", content: parts },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.workspaceId, opts.clientPageAction),
      });
      const json = extractFenceJson(text, DETAIL_PAGE_VISION_DECOMPOSE_FENCE);
      return normalizeDetailPageVisionDecompose(json);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (!isGatewayOrTransportError(e)) {
        throw lastErr;
      }
    }
  }
  throw lastErr ?? new Error("视觉拆解失败");
}
