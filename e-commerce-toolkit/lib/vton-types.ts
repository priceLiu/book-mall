import type { VtonTryonProgress } from "@/lib/vton-tryon-progress";

export const ECOM_VTON_MAX_BATCH_LOOKS = 9;

export type VtonLookKind = "two_piece" | "one_piece" | "top_only" | "bottom_only" | "full_set";
export type VtonGarmentKind = "top" | "bottom" | "one_piece" | "full_set";

export type VtonGarmentItem = {
  id: string;
  kind: VtonGarmentKind;
  ossUrl: string;
  label?: string;
  source?: string;
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

export type VtonTryonResultVersion = {
  ossUrl: string;
  createdAt: string;
  resultId: string;
};

export type VtonTryonResult = {
  id: string;
  lookId: string;
  status: "pending" | "running" | "success" | "failed" | "cancelled";
  ossUrl?: string;
  failReason?: string;
  createdAt: string;
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

export type VtonLockedLook = {
  id: string;
  ossUrl: string;
  label?: string;
  source: "aitryon-plus" | "upload" | "import";
  resultId?: string;
  lockedAt: string;
};

export type VtonModelBodyShotType = "portrait" | "half_body" | "full_body" | "unknown";

export type VtonModelImageCheck = {
  ossUrl: string;
  isFullBody: boolean;
  shotType: VtonModelBodyShotType;
  checkedAt: string;
  fromAiFourView?: boolean;
};

export type VtonModelGeneration = {
  id: string;
  ossUrl: string;
  label?: string;
  source?: string;
  createdAt: string;
  confirmedAt?: string;
};

export type VtonProjectMeta = {
  garmentPool?: VtonGarmentItem[];
  lookDrafts?: VtonLookSpec[];
  tryonBatch?: VtonTryonBatchState | null;
  lockedLooks?: VtonLockedLook[];
  defaultLockedLookId?: string;
  tryonProgress?: VtonTryonProgress | null;
  tryonBatchCancelBatchId?: string | null;
  modelImageCheck?: VtonModelImageCheck | null;
  modelGenerations?: VtonModelGeneration[];
  previewModelGenerationId?: string;
  confirmedModelGenerationIds?: string[];
  activeModelGenerationId?: string;
};

export const ECOM_VTON_MODEL_ASSET_MODULE = "model-tryon-model";

export type VtonModelPipelineBusy =
  | "uploading"
  | "importing-model"
  | "generating-model"
  | "expanding-full-body";

export function parseVtonProjectMeta(raw: unknown): VtonProjectMeta {
  if (!raw || typeof raw !== "object") {
    return { garmentPool: [], lookDrafts: [], lockedLooks: [] };
  }
  const o = raw as Record<string, unknown>;
  return {
    garmentPool: Array.isArray(o.garmentPool) ? (o.garmentPool as VtonGarmentItem[]) : [],
    lookDrafts: Array.isArray(o.lookDrafts) ? (o.lookDrafts as VtonLookSpec[]) : [],
    tryonBatch: (o.tryonBatch as VtonTryonBatchState | null) ?? null,
    lockedLooks: Array.isArray(o.lockedLooks) ? (o.lockedLooks as VtonLockedLook[]) : [],
    defaultLockedLookId:
      typeof o.defaultLockedLookId === "string" ? o.defaultLockedLookId : undefined,
    tryonProgress: o.tryonProgress as VtonTryonProgress | null | undefined,
    modelImageCheck: (o.modelImageCheck as VtonModelImageCheck | null | undefined) ?? undefined,
    modelGenerations: Array.isArray(o.modelGenerations)
      ? (o.modelGenerations as VtonModelGeneration[])
      : undefined,
    previewModelGenerationId:
      typeof o.previewModelGenerationId === "string" ? o.previewModelGenerationId : undefined,
    confirmedModelGenerationIds: Array.isArray(o.confirmedModelGenerationIds)
      ? o.confirmedModelGenerationIds.filter((id): id is string => typeof id === "string")
      : undefined,
    activeModelGenerationId:
      typeof o.activeModelGenerationId === "string" ? o.activeModelGenerationId : undefined,
  };
}

export const VTON_TOP_GARMENT_SCOPE = "含: T 恤、外套、大衣";
export const VTON_BOTTOM_GARMENT_SCOPE = "含: 裤子、半裙";

/** 与百炼 aitryon-plus 服饰图要求一致的简短上传提示 */
export const VTON_GARMENT_UPLOAD_HINTS: Record<VtonGarmentKind, string> = {
  top: "平铺或上身图，单一上装、背景简洁、主体完整",
  bottom: "平铺或上身图，单一的下装、背景简洁、主体完整",
  one_piece: "平铺或上身图，连衣裙/连体衣单一主体",
  full_set:
    "一张图同时包含上装与下装（平铺或上身均可）；试衣前将自动分割并传入上下装双槽",
};

/** 入库默认名、缩略图副标题等短文案 */
export const VTON_GARMENT_KIND_SHORT_LABELS: Record<VtonGarmentKind, string> = {
  top: "上装",
  bottom: "下装",
  one_piece: "连体/裙",
  full_set: "套装",
};

export const VTON_LOOK_KIND_LABELS: Record<VtonLookKind, string> = {
  two_piece: "上下装",
  one_piece: "连体/裙",
  top_only: `仅上装 (${VTON_TOP_GARMENT_SCOPE})`,
  bottom_only: `仅下装 (${VTON_BOTTOM_GARMENT_SCOPE})`,
  full_set: "套装（上下装双槽）",
};

export const VTON_GARMENT_KIND_LABELS: Record<VtonGarmentKind, string> = {
  top: `上装 (${VTON_TOP_GARMENT_SCOPE})`,
  bottom: `下装 (${VTON_BOTTOM_GARMENT_SCOPE})`,
  one_piece: "连体/裙",
  full_set: "套装（上下装双槽）",
};

export const VTON_GARMENT_POOL_KINDS: VtonGarmentKind[] = [
  "top",
  "bottom",
  "one_piece",
  "full_set",
];
