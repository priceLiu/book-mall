import type { WorkflowRefImage, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";

export const ECOM_VTON_TOOL_KEY = "ecom-toolkit__vton";
export const ECOM_VTON_MODEL_GENERATE_ACTION = "model-generate";
export const ECOM_VTON_EXPAND_FULL_BODY_ACTION = "expand-full-body";
export const ECOM_VTON_TRYON_ACTION = "tryon";
export const ECOM_VTON_REFINE_ACTION = "tryon-refine";

export const ECOM_VTON_TRYON_MODEL = "aitryon-plus";
export const ECOM_VTON_REFINER_MODEL = "aitryon-refiner";

export type VtonTryonRefinerGender = "woman" | "man";
/** 模特试衣 · 生模特 / 头像扩全身 · 固定模型（用户不可选） */
export const ECOM_VTON_MODEL_GEN_MODEL = "wan2.7-image-pro";
/** 模特试衣 · 上传图全身检测 */
export const ECOM_VTON_MODEL_BODY_DETECT_MODEL = "qwen3-vl-flash";
export const ECOM_VTON_MAX_BATCH_LOOKS = 9;

export type VtonModelBodyShotType = "portrait" | "half_body" | "full_body" | "unknown";

/** VLM 全身检测原始结果（仅入库时写入 generation.bodyCheck） */
export type VtonModelImageCheck = {
  ossUrl: string;
  isFullBody: boolean;
  shotType: VtonModelBodyShotType;
  checkedAt: string;
  /** @deprecated 使用 generation.bodyCheck.fromAiGenerate */
  fromAiFourView?: boolean;
};

/** 每张模特版本独立的全身取景标签 */
export type VtonModelGenerationBodyCheck = {
  status: "pending" | "done" | "failed";
  shotType?: VtonModelBodyShotType;
  isFullBody?: boolean;
  checkedAt?: string;
  /** AI 生模特 / 扩全身 · 跳过 VLM */
  fromAiGenerate?: boolean;
};

export type VtonGarmentMode = "two_piece" | "one_piece";
export type VtonRefMode = "already_dressed" | "need_tryon" | "text_to_tryon";

export type VtonTextTryonRef = {
  id: string;
  ossUrl: string;
  label?: string;
  createdAt: string;
};

export type VtonTextTryonResult = {
  id: string;
  ossUrl: string;
  prompt: string;
  modelKey: string;
  createdAt: string;
  /** 出图比例（如 3:4）；与 width/height 一并写入，便于结果格按成片比例展示 */
  ratio?: "1:1" | "3:4" | "4:5" | "16:9";
  width?: number;
  height?: number;
};

export type VtonLookKind = "two_piece" | "one_piece" | "top_only" | "bottom_only" | "full_set";

export type VtonGarmentKind = "top" | "bottom" | "one_piece" | "full_set";

export type VtonFullSetInputMode = "composite" | "manual";

export type VtonGarmentItem = {
  id: string;
  kind: VtonGarmentKind;
  ossUrl: string;
  label?: string;
  source?: WorkflowRefImage["source"];
  /** 套装入库方式：整图自动分割 vs 用户已拆分双槽 */
  fullSetInputMode?: VtonFullSetInputMode;
  /** 套装图上传时预分割的上装平铺图（供 aitryon 双槽） */
  parsedTopUrl?: string;
  /** 套装图上传时预分割的下装平铺图（供 aitryon 双槽） */
  parsedBottomUrl?: string;
};

export type VtonLookSpec = {
  id: string;
  kind: VtonLookKind;
  label?: string;
  topGarmentId?: string;
  bottomGarmentId?: string;
  onePieceGarmentId?: string;
  fullSetGarmentId?: string;
};

export type VtonTryonResultStatus = "pending" | "running" | "success" | "failed" | "cancelled";

export type VtonTryonResultVersion = {
  ossUrl: string;
  createdAt: string;
  resultId: string;
};

export type VtonTryonResult = {
  id: string;
  lookId: string;
  status: VtonTryonResultStatus;
  ossUrl?: string;
  failReason?: string;
  createdAt: string;
  /** 同套搭配多次试衣 / 重生成的历史成片 */
  versions?: VtonTryonResultVersion[];
  activeVersionIndex?: number;
};

export type VtonTryonBatchState = {
  batchId: string;
  status: "running" | "done" | "failed" | "cancelled";
  currentIndex: number;
  total: number;
  label?: string;
  results: VtonTryonResult[];
  updatedAt: string;
};

export type VtonLockedLookSource = "aitryon-plus" | "upload" | "import";

export type VtonLockedLook = {
  id: string;
  ossUrl: string;
  label?: string;
  source: VtonLockedLookSource;
  resultId?: string;
  lockedAt: string;
};

/** 项目内模特版本（上传 / 模特库 / AI 生成 · 只增不盖） */
export type VtonModelGeneration = {
  id: string;
  ossUrl: string;
  label?: string;
  source?: WorkflowRefImage["source"];
  createdAt: string;
  /** 入库时写入 · 上传/VLM 或 AI 直标 */
  bodyCheck?: VtonModelGenerationBodyCheck;
  /** 用户点击「确认加入待试衣」后写入 */
  confirmedAt?: string;
};

/** 试衣工作流 meta（model-tryon / outfit-video 共用） */
export type VtonProjectMeta = {
  garmentPool?: VtonGarmentItem[];
  lookDrafts?: VtonLookSpec[];
  tryonBatch?: VtonTryonBatchState | null;
  lockedLooks?: VtonLockedLook[];
  defaultLockedLookId?: string;
  tryonProgress?: VtonTryonProgress | null;
  tryonHistory?: VtonTryonHistoryEntry[];
  /** 与 tryonBatch.batchId 一致时表示请求停止当前批量试衣 */
  tryonBatchCancelBatchId?: string | null;
  /** 本项目内全部模特版本（左栏候选历史） */
  modelGenerations?: VtonModelGeneration[];
  /** 中栏预览选中的候选 id */
  previewModelGenerationId?: string;
  /** 右栏待试衣 · 已确认模特 id 列表（有序） */
  confirmedModelGenerationIds?: string[];
  /** 当前试衣使用的模特版本 id（须在 confirmed 内） */
  activeModelGenerationId?: string;
  /** 文生试衣 · 参考图列表 */
  textTryonRefs?: VtonTextTryonRef[];
  /** 文生试衣 · Prompt（含 @图片N） */
  textTryonPrompt?: string;
  /** 文生试衣 · 生成结果（新结果追加在前） */
  textTryonResults?: VtonTextTryonResult[];
  /** 用户点击「清空编辑区」后为 true，不再自动注入内置示例 */
  textTryonDemoSuppressed?: boolean;
};

/** 电商工具箱 · 我的模特库 module */
export const ECOM_VTON_MODEL_ASSET_MODULE = "model-tryon-model";

/** 试衣工作流参考图（与 WorkflowRefs 子集对齐） */
export type VtonRefs = Pick<
  WorkflowRefs,
  "model" | "clothing" | "topGarment" | "bottomGarment" | "dressedImage"
>;

export type VtonRefImage = WorkflowRefImage;

export type VtonTryonProgressPhase = "submitting" | "polling" | "persisting" | "done" | "failed";

export type VtonTryonProgress = {
  phase: VtonTryonProgressPhase;
  label: string;
  pollCount?: number;
  updatedAt: string;
};

export type VtonTryonHistoryEntry = {
  ossUrl: string;
  createdAt: string;
  garmentMode: VtonGarmentMode;
  label?: string;
};

export type VtonTryonUrlInputs = {
  personImageUrl: string;
  topGarmentUrl?: string;
  bottomGarmentUrl?: string;
  lookKind: VtonLookKind;
};
