/** 多 Pro vertical 共享的后五维枚举 */

export const PRO_STYLE_ATTRIBUTES = [
  "职场办公",
  "日常休闲",
  "潮流街头",
  "户外机能",
  "极简高级",
  "温柔气质",
] as const;

export const PRO_TIERS = ["平价刚需", "中端质感", "高端轻奢"] as const;

export const PRO_PLATFORMS = [
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

export const PRO_OUTPUT_LANGUAGES = [
  "中文",
  "英文",
  "西班牙语",
  "葡萄牙语",
  "阿拉伯语",
] as const;

export const PRO_SHARED_DIMENSION_TAIL: Array<{
  key: string;
  label: string;
  options?: readonly string[];
  freeText?: boolean;
}> = [
  { key: "styleAttribute", label: "风格属性", options: PRO_STYLE_ATTRIBUTES },
  { key: "tier", label: "档次定位", options: PRO_TIERS },
  { key: "customScene", label: "使用场景", freeText: true },
  { key: "platform", label: "发布平台", options: PRO_PLATFORMS },
  { key: "outputLanguage", label: "输出语言", options: PRO_OUTPUT_LANGUAGES },
];

export const PRO_SHOT_SCALE_BY_INDEX: Record<number, string> = {
  1: "全景/中全景",
  2: "中全景/中景",
  3: "中近景/近景",
  4: "近景/特写",
  5: "中景",
  6: "中全景",
};

export const PRO_VERSION_KEYS = ["A", "B", "C", "D", "E"] as const;
