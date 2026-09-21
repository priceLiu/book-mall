import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";
import { z } from "zod";

import { DETAIL_PAGE_VISION_INVENTORY_FENCE } from "./inventory-constants";
import {
  buildDetailPageVisionInventorySystem,
  buildDetailPageVisionInventoryUserText,
} from "./inventory-prompts";
import {
  extractFenceJson,
  normalizeDetailPageVisionInventory,
  type DetailPageVisionInventory,
} from "./inventory-schemas";

function isGatewayOrTransportError(e: unknown): boolean {
  if (e instanceof z.ZodError) return false;
  const msg = e instanceof Error ? e.message : String(e);
  if (/未返回有效 JSON|校验失败|schemaVersion|不支持|围栏|清单/.test(msg)) {
    return false;
  }
  return true;
}

export type RunDetailPageVisionInventoryOpts = {
  userId: string;
  referenceImageUrls: string[];
  visionModelKey?: string;
  clientPageAction: string;
  workspaceId: string;
  productDesc?: string | null;
};

export async function runDetailPageVisionInventory(
  opts: RunDetailPageVisionInventoryOpts,
): Promise<DetailPageVisionInventory> {
  const urls = opts.referenceImageUrls.map((u) => u.trim()).filter(Boolean);
  if (urls.length === 0) throw new Error("请先上传参考详情长图");

  const modelKey = opts.visionModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const max = getVisionMaxInputImages(modelKey);
  const imageUrls = urls.slice(0, max);

  const parts: CanvasChatContentPart[] = [
    ...imageUrls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text" as const,
      text: buildDetailPageVisionInventoryUserText({ productDesc: opts.productDesc }),
    },
  ];

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const text = await drainEcomGwChat(opts.userId, {
        modelKey,
        messages: [
          { role: "system", content: buildDetailPageVisionInventorySystem() },
          { role: "user", content: parts },
        ] as CanvasChatMessage[],
        clientPage: ecomClientPage(opts.userId, opts.workspaceId, opts.clientPageAction),
      });
      const json = extractFenceJson(text, DETAIL_PAGE_VISION_INVENTORY_FENCE);
      return normalizeDetailPageVisionInventory(json);
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (!isGatewayOrTransportError(e)) throw lastErr;
    }
  }
  throw lastErr ?? new Error("视觉清单拆解失败");
}
