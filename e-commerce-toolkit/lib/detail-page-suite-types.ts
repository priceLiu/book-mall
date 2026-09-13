export type DetailPageSuiteModuleDef = {
  module_id: string;
  module_name: string;
  required: boolean;
  max_num: number;
  candidate_pool: string[];
};

export type DetailPageSuiteTemplate = {
  id: string;
  platformCode: string;
  categoryKey: string;
  templateName: string;
  categoryLabel: string;
  type: "system" | "user";
  status: "enable" | "disable";
  remark: string | null;
  modules: DetailPageSuiteModuleDef[];
};

export type DetailPageSuiteSellpoint = {
  id: string;
  text: string;
  source: "user" | "vision" | "ai";
};

export type DetailPageSuiteBrief = {
  genderCategory?: string;
  styleCategory?: string;
  styleAttribute?: string;
  tier?: string;
  customScene?: string;
  platform?: string;
  platformCode?: string;
  outputLanguage?: string;
  productDesc?: string;
  sellPoints?: DetailPageSuiteSellpoint[];
  sellpointsLocked?: boolean;
};

export type DetailPageSuiteReference = {
  id: string;
  label: string;
  role: "product";
  ossUrl: string;
};

export type DetailPageSuiteChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type DetailPageSuiteSlotImageVersion = {
  url: string;
  assetId?: string;
  createdAt: string;
};

export type DetailPageSuiteSlot = {
  item_key: string;
  item_label: string;
  source: "template" | "user";
  positive_prompt: string;
  imageUrl?: string;
  assetId?: string;
  /** 同格多次生成的历史；最早在前，最新在后 */
  imageHistory?: DetailPageSuiteSlotImageVersion[];
  /** 格内正在查看的版本下标，默认最新 */
  activeImageIndex?: number;
  /** 是否勾选参与出图；默认 true（有 prompt 时） */
  selectedForImage?: boolean;
  promptEdited?: boolean;
};

export type DetailPageSuiteModuleState = {
  module_id: string;
  module_name: string;
  enable: boolean;
  generate_count: number;
  max_num: number;
  select_mode: "manual" | "random";
  candidate_pool: string[];
  selected_item_list: string[];
  slots: DetailPageSuiteSlot[];
};

export type DetailPageSuiteState = {
  templateId?: string;
  templateSnapshot?: DetailPageSuiteTemplate | null;
  modules: DetailPageSuiteModuleState[];
};

export type DetailPageSuitePhase =
  | "product_ref"
  | "dimensions"
  | "sellpoints"
  | "template"
  | "modules"
  | "subdims"
  | "prompts"
  | "images"
  | "done";

export type DetailPageSuiteProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: DetailPageSuiteBrief | null;
  settings: {
    chatModelKey?: string;
    visionModelKey?: string;
    imageModelKey?: string;
    imageSize?: string;
    /** 展示/出图比例，默认跟平台 detailPage.ratio */
    imageRatio?: "1:1" | "3:4" | "4:5" | "16:9";
  };
  references: DetailPageSuiteReference[];
  chatHistory: DetailPageSuiteChatMessage[];
  suite: DetailPageSuiteState;
  meta: {
    phase?: DetailPageSuitePhase;
    dimensionStep?: number;
    templateId?: string;
    pendingImages?: Record<string, { startedAt: string; modelKey?: string }>;
    pendingPromptModules?: Record<string, { startedAt: string }>;
    promptSnapshots?: Record<string, { prompt: string; itemLabel: string; updatedAt: string }>;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export const SUITE_PLATFORM_OPTIONS: Array<{ label: string; code: string }> = [
  { label: "淘宝/天猫", code: "taobao-tmall" },
  { label: "京东", code: "jd" },
  { label: "拼多多", code: "pdd" },
  { label: "抖音电商（抖店）", code: "douyin" },
  { label: "快手小店", code: "kuaishou" },
  { label: "小红书商城", code: "xiaohongshu" },
  { label: "视频号小店", code: "wechat-channels" },
  { label: "1688阿里巴巴批发", code: "1688" },
  { label: "唯品会", code: "vip" },
  { label: "亚马逊（跨境）", code: "amazon" },
  { label: "Shopee/Lazada（东南亚跨境）", code: "shopee-lazada" },
  { label: "独立站", code: "independent" },
];

export function platformCodeFromLabel(label: string): string {
  const hit = SUITE_PLATFORM_OPTIONS.find((p) => p.label === label || p.code === label);
  if (hit) return hit.code;
  const fashion: Record<string, string> = {
    淘宝: "taobao-tmall",
    京东: "jd",
    拼多多: "pdd",
    抖音: "douyin",
    小红书: "xiaohongshu",
    亚马逊: "amazon",
    Shopee: "shopee-lazada",
    Lazada: "shopee-lazada",
    "TikTok Shop": "douyin",
    速卖通: "independent",
  };
  return fashion[label] ?? "taobao-tmall";
}

export const SUITE_RAIL_STEPS: Array<{ id: DetailPageSuitePhase; label: string; short: string }> = [
  { id: "product_ref", label: "产品图", short: "1" },
  { id: "dimensions", label: "七维", short: "2" },
  { id: "sellpoints", label: "卖点", short: "3" },
  { id: "template", label: "模板", short: "4" },
  { id: "modules", label: "模块", short: "5" },
  { id: "subdims", label: "子维度", short: "6" },
  { id: "prompts", label: "提示词", short: "7" },
  { id: "images", label: "出图", short: "8" },
];
