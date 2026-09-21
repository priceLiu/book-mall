/**
 * 与 book-mall/lib/ecom/detail-page-suite/brief-context.ts 保持同步：
 * 前端打开提示词编辑时补齐【全片一致】【本张拍摄要求】，保证所见即所出。
 */
import type { DetailPageSuiteBrief } from "@/lib/detail-page-suite-types";

/** 与 book-mall types.ts BLANK_PLATE_MODULE_IDS 一致 */
export const DETAIL_PAGE_SUITE_BLANK_PLATE_MODULE_IDS = new Set(["mod12_aftersale"]);

function detailPageSuiteModuleIsBlankPlate(moduleId: string | undefined): boolean {
  return Boolean(moduleId?.trim() && DETAIL_PAGE_SUITE_BLANK_PLATE_MODULE_IDS.has(moduleId.trim()));
}

function hasDetailPageSuiteGlobalPrefixBlock(prompt: string): boolean {
  return prompt.includes("【全片一致】") || prompt.includes("【留白底板】");
}

function hasDetailPageSuiteShootingRequirementBlock(prompt: string): boolean {
  return prompt.includes("【本张拍摄要求】");
}

export function stripDetailPageSuitePromptEnvelope(storedPrompt: string): string {
  let body = storedPrompt.trim();
  body = body.replace(/^【全片一致】[^。]*。\s*/, "").trim();
  body = body.replace(/^【留白底板】[^。]*。\s*/, "").trim();
  body = body.replace(/^【本张拍摄要求】[^。]*。\s*/, "").trim();
  return body;
}

function buildDetailPageSuiteImageGlobalPrefix(
  brief: DetailPageSuiteBrief | null | undefined,
  moduleId?: string,
): string {
  const b = brief ?? {};
  if (detailPageSuiteModuleIsBlankPlate(moduleId)) {
    const tone = [b.tier, b.styleAttribute].filter(Boolean).join("，");
    return tone
      ? `【全片一致】影调档次与全详情页一致（${tone}）；留白底板，无服装无模特无产品实物`
      : "【留白底板】无服装无模特无产品实物，仅纯色干净背景与预留空白区域";
  }
  const parts: string[] = [];
  const dims = [
    b.genderCategory && `性别品类${b.genderCategory}`,
    b.styleCategory && `款式${b.styleCategory}`,
    b.styleAttribute && `风格${b.styleAttribute}`,
    b.tier && `档次${b.tier}`,
    b.customScene?.trim() && `场景${b.customScene.trim()}`,
    (b.platform ?? b.platformCode) && `平台${b.platform ?? b.platformCode}`,
  ].filter(Boolean) as string[];
  if (dims.length > 0) {
    parts.push(`【全片一致】${dims.join("，")}`);
  }
  const g = b.genderCategory?.trim();
  if (g === "女装" || g === "裙装") {
    parts.push("同一位成年女性模特");
  } else if (g === "男装") {
    parts.push("同一位成年男性模特");
  }
  parts.push("服装款式颜色与产品参考图完全一致");
  const sellpointText = (b.sellPoints ?? []).map((s) => s.text.trim()).filter(Boolean).join("，");
  if (sellpointText) {
    parts.push(`突出卖点：${sellpointText}`);
  }
  return parts.filter(Boolean).join("；");
}

export function composeDetailPageSuiteVisiblePrompt(
  storedPrompt: string,
  brief: DetailPageSuiteBrief | null | undefined,
  itemLabel?: string,
  moduleId?: string,
): string {
  const body = stripDetailPageSuitePromptEnvelope(storedPrompt);
  const globalPrefix = buildDetailPageSuiteImageGlobalPrefix(brief, moduleId).trim();
  const label = itemLabel?.trim();
  const shootingReq = label ? `【本张拍摄要求】${label}` : "";
  const globalBlock =
    globalPrefix && !hasDetailPageSuiteGlobalPrefixBlock(body) ? globalPrefix : "";
  const shootingBlock =
    shootingReq && !hasDetailPageSuiteShootingRequirementBlock(body) ? shootingReq : "";
  return [globalBlock, shootingBlock, body].filter(Boolean).join("。");
}
