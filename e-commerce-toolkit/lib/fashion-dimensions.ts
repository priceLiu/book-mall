/** 服装专业版 V4.4 · 七维枚举（与 docs/服装电商.md 一致） */

export const FASHION_GENDER_OPTIONS = ["男装", "女装", "裙装"] as const;
export type FashionGender = (typeof FASHION_GENDER_OPTIONS)[number];

export const FASHION_STYLE_CATEGORIES = [
  "T恤",
  "衬衫",
  "卫衣",
  "针织衫",
  "毛衣",
  "背心",
  "吊带",
  "打底内搭",
  "夹克",
  "风衣",
  "大衣",
  "防晒衣",
  "冲锋衣",
  "西裤",
  "休闲裤",
  "牛仔裤",
  "阔腿裤",
  "半身裙",
  "吊带裙",
  "西装裙",
  "针织裙",
  "连衣裙",
  "两件套",
  "运动套装",
  "西装套装",
] as const;

export const FASHION_STYLE_ATTRIBUTES = [
  "职场办公",
  "日常休闲",
  "潮流街头",
  "户外机能",
  "极简高级",
  "温柔气质",
] as const;

export const FASHION_TIERS = ["平价刚需", "中端质感", "高端轻奢"] as const;

export const FASHION_PLATFORMS = [
  "淘宝",
  "京东",
  "拼多多",
  "抖音",
  "小红书",
  "亚马逊",
  "TikTok Shop",
  "Shopee",
  "Lazada",
  "速卖通",
] as const;

export const FASHION_OUTPUT_LANGUAGES = [
  "中文",
  "英文",
  "西班牙语",
  "葡萄牙语",
  "阿拉伯语",
] as const;

export type FashionDimensionKey =
  | "genderCategory"
  | "styleCategory"
  | "styleAttribute"
  | "tier"
  | "customScene"
  | "platform"
  | "outputLanguage";

export const FASHION_DIMENSION_STEPS: Array<{
  key: FashionDimensionKey;
  label: string;
  options?: readonly string[];
  freeText?: boolean;
}> = [
  { key: "genderCategory", label: "性别品类", options: FASHION_GENDER_OPTIONS },
  { key: "styleCategory", label: "款式品类", options: FASHION_STYLE_CATEGORIES },
  { key: "styleAttribute", label: "风格属性", options: FASHION_STYLE_ATTRIBUTES },
  { key: "tier", label: "档次定位", options: FASHION_TIERS },
  { key: "customScene", label: "自定义场景", freeText: true },
  { key: "platform", label: "发布平台", options: FASHION_PLATFORMS },
  { key: "outputLanguage", label: "输出语言", options: FASHION_OUTPUT_LANGUAGES },
];

export function fashionDimensionPrompt(stepIndex: number): string {
  const step = FASHION_DIMENSION_STEPS[stepIndex];
  if (!step) return "请选择参数";
  if (step.freeText) return `请输入${step.label}（如：都市通勤、周末露营）`;
  return `请选择${step.label}`;
}

export function fashionDimensionStepProgress(stepIndex: number): string {
  if (stepIndex < 0 || stepIndex >= FASHION_DIMENSION_STEPS.length) return "";
  return `${stepIndex + 1}/${FASHION_DIMENSION_STEPS.length}`;
}

export type FashionDimensionMessageLabel = {
  label: string;
  stepIndex: number;
  progress: string;
};

const FASHION_POST_DIMENSION_USER_MESSAGES = new Set([
  "AI自动生成卖点",
  "确认卖点清单",
  "重新生成口播文案",
  "重新生成卖点",
  "确认分镜，生成运营包",
  "重新选择分镜版本",
  "重新生成分镜",
  "分镜脚本交付",
  "故事版一键成片",
  "已上传产品图",
]);

function isFashionPostDimensionUserMessage(text: string): boolean {
  const trimmed = text.trim();
  if (FASHION_POST_DIMENSION_USER_MESSAGES.has(trimmed)) return true;
  if (trimmed.startsWith("选择口播")) return true;
  if (trimmed.startsWith("选择分镜")) return true;
  if (trimmed.startsWith("fashion-step:")) return true;
  return false;
}

/** 将七维采集阶段的用户消息映射为左侧「产品参数档案」对应字段名 */
export function buildFashionDimensionMessageLabels(
  messages: Array<{ id: string; role: string; content: string }>,
): Map<string, FashionDimensionMessageLabel> {
  const labels = new Map<string, FashionDimensionMessageLabel>();
  let dimStep = 0;
  let awaitingCustom = false;

  for (const m of messages) {
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    if (!trimmed || trimmed === "已上传产品图") continue;
    if (dimStep >= FASHION_DIMENSION_STEPS.length) break;
    if (isFashionPostDimensionUserMessage(trimmed)) break;

    const step = FASHION_DIMENSION_STEPS[dimStep]!;
    const progress = fashionDimensionStepProgress(dimStep);

    if (trimmed === "自定义") {
      labels.set(m.id, { label: `${step.label} · 自定义`, stepIndex: dimStep, progress });
      awaitingCustom = true;
      continue;
    }

    if (awaitingCustom) {
      labels.set(m.id, { label: step.label, stepIndex: dimStep, progress });
      awaitingCustom = false;
      dimStep++;
      continue;
    }

    labels.set(m.id, { label: step.label, stepIndex: dimStep, progress });
    dimStep++;
  }

  return labels;
}

/** 从用户聊天消息还原七维参数（助手点选/输入的 ground truth） */
export function buildFashionDimensionsFromChat(
  messages: Array<{ role: string; content: string }>,
): Partial<Record<FashionDimensionKey, string>> {
  const dimensions: Partial<Record<FashionDimensionKey, string>> = {};
  let dimStep = 0;
  let awaitingCustom = false;

  for (const m of messages) {
    if (m.role !== "user") continue;
    const trimmed = m.content.trim();
    if (!trimmed || trimmed === "已上传产品图") continue;
    if (dimStep >= FASHION_DIMENSION_STEPS.length) break;
    if (isFashionPostDimensionUserMessage(trimmed)) break;

    const step = FASHION_DIMENSION_STEPS[dimStep]!;
    if (trimmed === "自定义") {
      awaitingCustom = true;
      continue;
    }
    if (awaitingCustom) {
      dimensions[step.key] = trimmed;
      awaitingCustom = false;
      dimStep++;
      continue;
    }
    dimensions[step.key] = trimmed;
    dimStep++;
  }
  return dimensions;
}

/** 合并多来源七维；后者覆盖前者 */
export function mergeFashionDimensionSources(
  ...sources: Array<Partial<Record<FashionDimensionKey, string>> | undefined>
): Partial<Record<FashionDimensionKey, string>> {
  const next: Partial<Record<FashionDimensionKey, string>> = {};
  for (const source of sources) {
    if (!source) continue;
    for (const step of FASHION_DIMENSION_STEPS) {
      const value = source[step.key]?.trim();
      if (value) next[step.key] = value;
    }
  }
  return next;
}
