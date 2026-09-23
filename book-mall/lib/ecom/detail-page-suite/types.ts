import type { DetailPageSuiteCopyOverlay } from "./slot-copy-overlay-types";

export const ECOM_DETAIL_PAGE_SUITE_TOOL_KEY = "ecom-toolkit__detail-page-suite";
export const ECOM_DETAIL_PAGE_SUITE_REPLICA_TOOL_KEY =
  "ecom-toolkit__detail-page-suite-replica";
export const ECOM_DETAIL_PAGE_SUITE_HIT_TOOL_KEY = "ecom-toolkit__detail-page-suite-hit";
export const ECOM_DETAIL_PAGE_SUITE_MODULE = "detail-page-suite";
export const ECOM_DETAIL_PAGE_SUITE_REPLICA_MODULE = "detail-page-suite-replica";
export const ECOM_DETAIL_PAGE_SUITE_HIT_MODULE = "detail-page-suite-hit";
export const DETAIL_PAGE_SUITE_HIT_FENCE = "detail-page-suite-hit";
export const DETAIL_PAGE_SUITE_HIT_REWRITE_FENCE = "detail-page-suite-hit-rewrite";
export const DETAIL_PAGE_SUITE_HIT_SCHEMA_VERSION = "detail-page-suite-hit/v1";
export const DETAIL_PAGE_SUITE_HIT_REWRITE_SCHEMA_VERSION =
  "detail-page-suite-hit-rewrite/v1";
export const DETAIL_PAGE_SUITE_REPLICA_FENCE = "detail-page-suite-replica";
export const DETAIL_PAGE_SUITE_REPLICA_POLISH_FENCE = "detail-page-suite-replica-polish";
export const DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_FENCE =
  "detail-page-suite-replica-polish-batch";
export const DETAIL_PAGE_SUITE_REPLICA_SCHEMA_VERSION = "detail-page-suite-replica/v1";
export const DETAIL_PAGE_SUITE_REPLICA_POLISH_SCHEMA_VERSION =
  "detail-page-suite-replica-polish/v1";
export const DETAIL_PAGE_SUITE_REPLICA_POLISH_BATCH_SCHEMA_VERSION =
  "detail-page-suite-replica-polish-batch/v1";
export const ECOM_DETAIL_PAGE_SUITE_GLOBAL_MAX = 49;
export const DETAIL_PAGE_SUITE_FENCE = "detail-page-suite";
export const DETAIL_PAGE_SUITE_SCHEMA_VERSION = "detail-page-suite/v1";

export const DETAIL_PAGE_SUITE_NEGATIVE_PROMPT =
  "水印，文字，乱码，变形，肢体畸形，手指残缺，人脸扭曲，画面闪烁，模糊，噪点过高，曝光过度，死黑，色差严重，多余杂物，背景杂乱，3D卡通，手绘，插画，油画，畸形服装，衣服褶皱崩坏";

/** 仅售后等纯底图模块；卖点汇总 mod2 须带产品参考图 */
export const BLANK_PLATE_MODULE_IDS = new Set(["mod12_aftersale"]);

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

export type DetailPageSuiteSizeChartTable = {
  title?: string;
  headers: string[];
  rows: string[][];
  /** 演示样例；正式出图前应替换为本款真实数据 */
  isDemo?: boolean;
};

export type DetailPageSuiteSizeChartState = {
  tables?: DetailPageSuiteSizeChartTable[];
  fitNote?: string;
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
  sizeChart?: DetailPageSuiteSizeChartState;
};

export type DetailPageSuiteReferenceRole = "product" | "reference_suite" | "model";

export type DetailPageSuiteReference = {
  id: string;
  label: string;
  role: DetailPageSuiteReferenceRole;
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
  /** 多平台出图：对应 settings.exportTargets[].id */
  exportTargetId?: string;
  platformLabel?: string;
};

export type DetailPageSuiteExportTarget = {
  id: string;
  platformCode: string;
  label: string;
  ratio: "1:1" | "3:4" | "4:5" | "16:9";
  widthPx: number;
  customHeightPx?: number;
};

export type DetailPageSuiteSlot = {
  item_key: string;
  item_label: string;
  /** 爆款套图：分配到卡位的原创详情文案（非竞品原文） */
  slot_copy?: string;
  /** 爆款套图：最近一次 AI 生成的文案基准（恢复 AI 版） */
  slot_copy_ai?: string;
  /** 爆款套图：出图时将 slot_copy 烧录进画面 */
  burn_copy_in_image?: boolean;
  /** 爆款套图：程序合成排版的文字层（非 AI 烧字） */
  copy_overlay?: DetailPageSuiteCopyOverlay;
  source: "template" | "user";
  positive_prompt: string;
  negative_prompt?: string;
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
  /** 爆款套图：出图时把 slot_copy 一并写入生图 prompt */
  hitIncludeSlotCopyOnImage?: boolean;
  /** 可出图的平台规格列表（含自定义宽） */
  exportTargets?: DetailPageSuiteExportTarget[];
  /** 当前勾选参与批量出图的 exportTargets.id */
  activeExportTargetIds?: string[];
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

export type DetailPageSuitePendingImageEntry = {
  startedAt: string;
  modelKey?: string;
};

export type DetailPageSuitePendingPromptEntry = {
  startedAt: string;
};

export type DetailPageSuitePromptSnapshot = {
  prompt: string;
  itemLabel: string;
  updatedAt: string;
};

export type DetailPageSuiteReplicaStatus =
  | "idle"
  | "decomposing"
  | "decomposed"
  | "polishing"
  | "ready"
  | "error";

export type DetailPageSuiteHitStatus = DetailPageSuiteReplicaStatus;

/** 复刻拆解 / 润色 UI 进度（持久化便于刷新与轮询） */
export type DetailPageSuiteReplicaProgress = {
  step: "vision" | "classify" | "polish" | "merge";
  title: string;
  detail?: string;
  /** 0–100，供前端轮询进度条 */
  percent?: number;
  doneModules?: number;
  totalModules?: number;
  updatedAt?: string;
};

/** 新品识图卖点异步任务（GET 项目轮询 progress.percent） */
export type DetailPageSuiteVisionSellpointJob = {
  status: "idle" | "running" | "done" | "error";
  progress?: {
    percent: number;
    title: string;
    detail?: string;
    updatedAt: string;
  };
  error?: string;
};

export type DetailPageSuiteMeta = {
  phase?: DetailPageSuitePhase;
  replicaPhaseA?: unknown;
  /** 先清单：自上而下 segment 列表（detail-page-suite-replica-inventory/v1） */
  replicaInventory?: unknown;
  /** item_key → 模块归属（auto 高置信 / manual） */
  replicaSegmentMapping?: Record<
    string,
    { module_id: string | null; source: "auto" | "manual"; confidence?: "high" | "low" }
  >;
  replicaStatus?: DetailPageSuiteReplicaStatus;
  replicaProgress?: DetailPageSuiteReplicaProgress;
  replicaError?: string;
  replicaWarning?: string;
  /** 爆款详情页套图：结构/文案/视觉范式（不含竞品原文原图） */
  hitTemplate?: unknown;
  hitTemplateSnapshot?: unknown;
  hitCopyParadigm?: unknown;
  hitMarketInsight?: unknown;
  hitStatus?: DetailPageSuiteHitStatus;
  hitProgress?: DetailPageSuiteReplicaProgress;
  hitError?: string;
  hitWarning?: string;
  hitVisionSellpoint?: DetailPageSuiteVisionSellpointJob;
  replicaVisionSellpoint?: DetailPageSuiteVisionSellpointJob;
  dimensionStep?: number;
  templateId?: string;
  /** `${moduleId}::${slotKey}` → 出图进行中（刷新后可恢复 busy） */
  pendingImages?: Record<string, DetailPageSuitePendingImageEntry>;
  /** moduleId → 模块提示词 LLM 进行中 */
  pendingPromptModules?: Record<string, DetailPageSuitePendingPromptEntry>;
  /** `${moduleId}::${slotKey}` → 提示词备份（出图失败 / slots 失步时可恢复） */
  promptSnapshots?: Record<string, DetailPageSuitePromptSnapshot>;
  /** `${moduleId}::${slotKey}` → 最近一次出图失败原因（便于 UI 与排障） */
  imageGenFailures?: Record<
    string,
    { message: string; failedAt: string; modelKey?: string }
  >;
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
