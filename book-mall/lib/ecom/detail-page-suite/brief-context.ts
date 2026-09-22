import { BLANK_PLATE_MODULE_IDS, type DetailPageSuiteBrief } from "./types";

export function detailPageSuiteModuleIsBlankPlate(moduleId: string | undefined): boolean {
  return Boolean(moduleId?.trim() && BLANK_PLATE_MODULE_IDS.has(moduleId.trim()));
}

/** 含「模特」或场景穿搭的模块，须强制性别品类约束 */
const MODEL_RELATED_MODULE_IDS = new Set([
  "mod1_banner",
  "mod3_model_show",
  "mod8_scene",
  "mod9_color_compare",
]);

function line(label: string, value: string | undefined): string | null {
  const v = value?.trim();
  return v ? `${label}：${v}` : null;
}

/** 七维 + 商品描述 + 卖点，供写提示词 LLM user 消息复用 */
export function buildDetailPageSuiteBriefContextLines(
  brief: DetailPageSuiteBrief | null | undefined,
): string[] {
  const b = brief ?? {};
  const sellpointText = (b.sellPoints ?? []).map((s) => s.text.trim()).filter(Boolean).join("，");
  return [
    line("商品描述", b.productDesc),
    line("商品卖点", sellpointText || undefined),
    line("性别品类", b.genderCategory),
    line("款式品类", b.styleCategory),
    line("风格属性", b.styleAttribute),
    line("档次定位", b.tier),
    line("自定义场景", b.customScene),
    line("发布平台", b.platform ?? b.platformCode),
    line("输出语言", b.outputLanguage ?? "中文"),
  ].filter((x): x is string => Boolean(x));
}

export function buildDetailPageSuiteBriefContextBlock(
  brief: DetailPageSuiteBrief | null | undefined,
): string {
  return buildDetailPageSuiteBriefContextLines(brief).join("\n");
}

export function detailPageSuiteModuleInvolvesModel(opts: {
  moduleId: string;
  moduleName: string;
  selectedLabels?: string[];
}): boolean {
  if (MODEL_RELATED_MODULE_IDS.has(opts.moduleId)) return true;
  if (opts.moduleName.includes("模特")) return true;
  return (opts.selectedLabels ?? []).some((l) => l.includes("模特"));
}

/** 性别品类 → 写提示词 system 附加硬规则 */
export function buildDetailPageSuiteGenderModelRule(
  genderCategory: string | undefined,
  involvesModel: boolean,
): string {
  if (!involvesModel) return "";
  const g = genderCategory?.trim();
  if (g === "女装" || g === "裙装") {
    return "9. 本模块含模特：须使用成年女性模特，全片同一位女性；严禁男性模特。";
  }
  if (g === "男装") {
    return "9. 本模块含模特：须使用成年男性模特，全片同一位男性；严禁女性模特。";
  }
  return "";
}

/** 留白底板（售后底图等）固定摄影正文，禁止 LLM 写服装主体 */
export function buildDetailPageSuiteBlankPlateBody(itemLabel: string): string {
  const label = itemLabel.trim();
  return [
    "电商商业摄影写实照片",
    label,
    "构图规整简洁，留白充足",
    "柔和均匀影棚布光，低反差干净质感，边缘清晰利落，背景平整无杂色",
    "8K超清",
    "画面内不出现任何文字、数字、表格线、图标、logo、水印",
    "无服装、无模特、无产品实物、无人物",
  ].join("，");
}

/** 出图 global prefix：从 brief 七维构建，拼在 slot 提示词前 */
export function buildDetailPageSuiteImageGlobalPrefix(
  brief: DetailPageSuiteBrief | null | undefined,
  opts?: { moduleId?: string; /** 烧字出图时省略卖点句，避免模型把卖点渲染成画面段落 */ omitSellpoints?: boolean },
): string {
  const b = brief ?? {};
  if (detailPageSuiteModuleIsBlankPlate(opts?.moduleId)) {
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
  if (!opts?.omitSellpoints) {
    const sellpointText = (b.sellPoints ?? []).map((s) => s.text.trim()).filter(Boolean).join("，");
    if (sellpointText) {
      parts.push(`突出卖点：${sellpointText}`);
    }
  }
  return parts.filter(Boolean).join("；");
}

function hasDetailPageSuiteGlobalPrefixBlock(prompt: string): boolean {
  return prompt.includes("【全片一致】");
}

function hasDetailPageSuiteShootingRequirementBlock(prompt: string): boolean {
  return prompt.includes("【本张拍摄要求】");
}

/** 单条子维度拍摄要求（卡片底部 item_label） */
export function buildDetailPageSuiteShootingRequirement(itemLabel: string | undefined): string {
  const label = itemLabel?.trim();
  if (!label) return "";
  return `【本张拍摄要求】${label}`;
}

/** 去掉已拼接的全局前缀/拍摄要求，供 LLM 重写时只润色正文 */
export function stripDetailPageSuitePromptEnvelope(storedPrompt: string): string {
  let body = storedPrompt.trim();
  body = body.replace(/^【全片一致】[^。]*。\s*/, "").trim();
  body = body.replace(/^【留白底板】[^。]*。\s*/, "").trim();
  body = body.replace(/^【本张拍摄要求】[^。]*。\s*/, "").trim();
  return body;
}

/**
 * 合成用户可见、可编辑、与出图一致的完整正向提示词。
 * LLM 只返回摄影润色正文；存库前由此函数拼接七维全局约束与本张拍摄要求。
 */
export function composeDetailPageSuiteVisiblePrompt(
  llmBody: string,
  brief: DetailPageSuiteBrief | null | undefined,
  itemLabel?: string,
  moduleId?: string,
  opts?: { omitSellpointsInPrefix?: boolean },
): string {
  const body = stripDetailPageSuitePromptEnvelope(llmBody);
  const globalPrefix = buildDetailPageSuiteImageGlobalPrefix(brief, {
    moduleId,
    omitSellpoints: opts?.omitSellpointsInPrefix,
  }).trim();
  const shootingReq = buildDetailPageSuiteShootingRequirement(itemLabel);
  const globalBlock =
    globalPrefix && !hasDetailPageSuiteGlobalPrefixBlock(body) ? globalPrefix : "";
  const shootingBlock =
    shootingReq && !hasDetailPageSuiteShootingRequirementBlock(body) ? shootingReq : "";
  return [globalBlock, shootingBlock, body].filter(Boolean).join("。");
}

/** @deprecated 请使用 composeDetailPageSuiteVisiblePrompt */
export function buildDetailPageSuiteImagePrompt(
  slotPrompt: string,
  brief: DetailPageSuiteBrief | null | undefined,
  itemLabel?: string,
): string {
  return composeDetailPageSuiteVisiblePrompt(slotPrompt, brief, itemLabel);
}

/** @deprecated 请使用 composeDetailPageSuiteVisiblePrompt */
export function applyDetailPageSuiteImageGlobalPrefix(
  slotPrompt: string,
  brief: DetailPageSuiteBrief | null | undefined,
): string {
  return composeDetailPageSuiteVisiblePrompt(slotPrompt, brief);
}
