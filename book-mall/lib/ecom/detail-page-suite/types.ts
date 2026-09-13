export const ECOM_DETAIL_PAGE_SUITE_TOOL_KEY = "ecom-toolkit__detail-page-suite";
export const ECOM_DETAIL_PAGE_SUITE_MODULE = "detail-page-suite";
export const ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX = 44;
export const DETAIL_PAGE_SUITE_FENCE = "detail-page-suite";
export const DETAIL_PAGE_SUITE_SCHEMA_VERSION = "detail-page-suite/v1";

export const DETAIL_PAGE_SUITE_NEGATIVE_PROMPT =
  "水印，文字，乱码，变形，肢体畸形，手指残缺，人脸扭曲，画面闪烁，模糊，噪点过高，曝光过度，死黑，色差严重，多余杂物，背景杂乱，3D卡通，手绘，插画，油画，畸形服装，衣服褶皱崩坏";

export const BLANK_PLATE_MODULE_IDS = new Set([
  "mod2_highlight",
  "mod7_size_table",
  "mod12_aftersale",
]);

export const DETAIL_PAGE_SUITE_CATEGORY_KEYS = [
  "outdoor_jacket",
  "business_shirt",
  "casual_tee",
] as const;
export type DetailPageSuiteCategoryKey = (typeof DETAIL_PAGE_SUITE_CATEGORY_KEYS)[number];

export type DetailPageSuiteModuleDef = {
  module_id: string;
  module_name: string;
  required: boolean;
  max_num: number;
  candidate_pool: string[];
};

export type DetailPageSuiteTemplateDto = {
  id: string;
  platformCode: string;
  categoryKey: string;
  templateName: string;
  categoryLabel: string;
  type: "system" | "user";
  status: "enable" | "disable";
  remark: string | null;
  modules: DetailPageSuiteModuleDef[];
  userId: string | null;
  createUser: string | null;
  createdAt: string;
  updatedAt: string;
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
  imageHistory?: DetailPageSuiteSlotImageVersion[];
  activeImageIndex?: number;
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
  templateSnapshot?: DetailPageSuiteTemplateDto | null;
  modules: DetailPageSuiteModuleState[];
};

export type DetailPageSuiteSettings = {
  chatModelKey?: string;
  visionModelKey?: string;
  imageModelKey?: string;
  imageSize?: string;
  imageRatio?: "1:1" | "3:4" | "4:5" | "16:9";
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

export type DetailPageSuiteMeta = {
  phase?: DetailPageSuitePhase;
  dimensionStep?: number;
  templateId?: string;
  pendingImages?: Array<{ moduleId: string; slotKey: string; logId?: string }>;
};

export type DetailPageSuiteProject = {
  id: string;
  title: string | null;
  module: string;
  status: string;
  brief: DetailPageSuiteBrief | null;
  settings: DetailPageSuiteSettings;
  references: DetailPageSuiteReference[];
  chatHistory: DetailPageSuiteChatMessage[];
  suite: DetailPageSuiteState;
  meta: DetailPageSuiteMeta | null;
  createdAt: string;
  updatedAt: string;
};
