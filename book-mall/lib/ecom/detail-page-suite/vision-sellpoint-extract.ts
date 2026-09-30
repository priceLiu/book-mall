import { randomUUID } from "crypto";

import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import {
  ECOM_SELLPOINT_FIVE_PART_LLM_RULES,
  ECOM_SELLPOINT_FIVE_PART_POLISH_RULES,
  formatEcomSellpointFivePartDocument,
  parseEcomSellpointFivePartJson,
  sellpointFivePartToDetailPageSellpoints,
  type EcomSellpointFivePart,
} from "@/lib/ecom/ecom-sellpoint-five-part";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import type { DetailPageSuiteSellpoint } from "./types";

const VISION_SYSTEM = `你是电商商品卖点策划专家。用户会提供多张自有新品产品实拍图。
${ECOM_SELLPOINT_FIVE_PART_LLM_RULES}
禁止从竞品详情图提取卖点。`;

export type SellpointVisionExtractResult = {
  sellpointFivePart: EcomSellpointFivePart;
  document: string;
  sellPoints: DetailPageSuiteSellpoint[];
};

function parseJsonFromLlmText(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("识图未返回有效 JSON");
  return JSON.parse(text.slice(start, end + 1));
}

export async function extractSellpointsFromProductImages(opts: {
  userId: string;
  projectId: string;
  toolKey: string;
  clientPageSuffix: string;
  productUrls: string[];
  productDesc?: string | null;
  modelKey?: string;
  settingsVisionModelKey?: string | null;
}): Promise<SellpointVisionExtractResult> {
  const productUrls = opts.productUrls.map((u) => u.trim()).filter(Boolean);
  if (productUrls.length === 0) throw new Error("请先上传至少 1 张新品产品图");

  const modelKey =
    opts.modelKey?.trim() || opts.settingsVisionModelKey?.trim() || ECOM_DEFAULT_VISION_MODEL;
  assertStoryLlmVisionModel(modelKey);
  const max = getVisionMaxInputImages(modelKey);
  const urls = productUrls.slice(0, max);

  const parts: CanvasChatContentPart[] = [
    ...urls.map((url) => ({ type: "image_url" as const, image_url: { url } })),
    {
      type: "text" as const,
      text: `商品简述：${opts.productDesc?.trim() || "见产品图"}。请按五段式 JSON 输出卖点资料。`,
    },
  ];

  const text = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      { role: "system", content: VISION_SYSTEM },
      { role: "user", content: parts },
    ] as CanvasChatMessage[],
    clientPage: ecomClientPage(opts.userId, opts.projectId, opts.clientPageSuffix),
  });

  const parsed = parseEcomSellpointFivePartJson(parseJsonFromLlmText(text));
  if (!parsed || parsed.coreSellingPoints.length === 0) {
    throw new Error("未能从图中识别出卖点");
  }
  const sellPoints = sellpointFivePartToDetailPageSellpoints(parsed).map((s) => ({
    ...s,
    id: randomUUID(),
    source: "vision" as const,
  }));
  return {
    sellpointFivePart: parsed,
    document: formatEcomSellpointFivePartDocument(parsed),
    sellPoints,
  };
}

export async function polishSellpointFivePartFromBrief(opts: {
  userId: string;
  projectId: string;
  clientPageSuffix: string;
  modelKey: string;
  part: EcomSellpointFivePart;
}): Promise<EcomSellpointFivePart> {
  const text = await drainEcomGwChat(opts.userId, {
    modelKey: opts.modelKey,
    messages: [
      {
        role: "system",
        content: `你是电商商品卖点润色编辑。\n${ECOM_SELLPOINT_FIVE_PART_POLISH_RULES}`,
      },
      {
        role: "user",
        content: `请润色以下 JSON：\n${JSON.stringify({
          product_name: opts.part.productName,
          core_selling_points: opts.part.coreSellingPoints,
          target_audience: opts.part.targetAudience,
          usage_scenarios: opts.part.usageScenarios,
          specifications: opts.part.specifications,
        })}`,
      },
    ] as CanvasChatMessage[],
    clientPage: ecomClientPage(opts.userId, opts.projectId, opts.clientPageSuffix),
  });
  const polished = parseEcomSellpointFivePartJson(parseJsonFromLlmText(text));
  if (!polished) throw new Error("润色未返回有效 JSON");
  return polished;
}
