import { randomUUID } from "crypto";

import type { CanvasChatContentPart, CanvasChatMessage } from "@/lib/canvas/providers/types";
import { assertStoryLlmVisionModel } from "@/lib/canvas/story-llm-vision-models";
import { drainEcomGwChat } from "@/lib/ecom/ecom-product-design-vision";
import { getVisionMaxInputImages } from "@/lib/ecom/ecom-product-design-ref-rules";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_DEFAULT_VISION_MODEL } from "@/lib/gateway/ecom-storyboard-chat-models";

import type { DetailPageSuiteSellpoint } from "./types";

const SYSTEM = `你是服装电商卖点提炼专家。用户会提供多张自有新品产品实拍图。
根据图片中的版型、面料、辅料、工艺、场景气质，提炼 4～8 条可直接用于详情页的卖点短句。
必须只输出 JSON 对象（不要 markdown）：
{ "sell_points": ["卖点1", "卖点2"] }
禁止编造图中看不到的材质成分或认证。禁止从竞品详情图提取卖点。`;

export async function extractSellpointsFromProductImages(opts: {
  userId: string;
  projectId: string;
  toolKey: string;
  clientPageSuffix: string;
  productUrls: string[];
  productDesc?: string | null;
  modelKey?: string;
  settingsVisionModelKey?: string | null;
}): Promise<DetailPageSuiteSellpoint[]> {
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
      text: `商品简述：${opts.productDesc?.trim() || "见产品图"}。请提炼卖点。`,
    },
  ];

  const text = await drainEcomGwChat(opts.userId, {
    modelKey,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: parts },
    ] as CanvasChatMessage[],
    clientPage: ecomClientPage(opts.userId, opts.projectId, opts.clientPageSuffix),
  });
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("识图未返回有效 JSON");
  const parsed = JSON.parse(text.slice(start, end + 1)) as { sell_points?: unknown };
  const lines = Array.isArray(parsed.sell_points)
    ? parsed.sell_points.map((x) => String(x).trim()).filter(Boolean)
    : [];
  if (lines.length === 0) throw new Error("未能从图中识别出卖点");
  return lines.map((textLine) => ({
    id: randomUUID(),
    text: textLine,
    source: "vision" as const,
  }));
}
