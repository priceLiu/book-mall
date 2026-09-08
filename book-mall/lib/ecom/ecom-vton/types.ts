import type { WorkflowRefImage, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";

export const ECOM_VTON_TOOL_KEY = "ecom-toolkit__vton";
export const ECOM_VTON_MODEL_GENERATE_ACTION = "model-generate";
export const ECOM_VTON_EXPAND_FULL_BODY_ACTION = "expand-full-body";
export const ECOM_VTON_TRYON_ACTION = "tryon";

export const ECOM_VTON_TRYON_MODEL = "aitryon-plus";
export const ECOM_VTON_MAX_BATCH_LOOKS = 9;

export type VtonGarmentMode = "two_piece" | "one_piece";
export type VtonRefMode = "already_dressed" | "need_tryon";

export type VtonLookKind = "two_piece" | "one_piece" | "top_only" | "bottom_only";

export type VtonGarmentKind = "top" | "bottom" | "one_piece";

export type VtonGarmentItem = {
  id: string;
  kind: VtonGarmentKind;
  ossUrl: string;
  label?: string;
  source?: WorkflowRefImage["source"];
};

export type VtonLookSpec = {
  id: string;
  kind: VtonLookKind;
  label?: string;
  topGarmentId?: string;
  bottomGarmentId?: string;
  onePieceGarmentId?: string;
};

export type VtonTryonResultStatus = "pending" | "running" | "success" | "failed";

export type VtonTryonResult = {
  id: string;
  lookId: string;
  status: VtonTryonResultStatus;
  ossUrl?: string;
  failReason?: string;
  createdAt: string;
};

export type VtonTryonBatchState = {
  batchId: string;
  status: "running" | "done" | "failed";
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

/** 试衣工作流 meta（model-tryon / outfit-video 共用） */
export type VtonProjectMeta = {
  garmentPool?: VtonGarmentItem[];
  lookDrafts?: VtonLookSpec[];
  tryonBatch?: VtonTryonBatchState | null;
  lockedLooks?: VtonLockedLook[];
  defaultLockedLookId?: string;
  tryonProgress?: VtonTryonProgress | null;
  tryonHistory?: VtonTryonHistoryEntry[];
};

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
