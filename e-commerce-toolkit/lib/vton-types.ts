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

export type VtonTryonResult = {
  id: string;
  lookId: string;
  status: "pending" | "running" | "success" | "failed";
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

export type VtonLockedLook = {
  id: string;
  ossUrl: string;
  label?: string;
  source: "aitryon-plus" | "upload" | "import";
  resultId?: string;
  lockedAt: string;
};

export type VtonProjectMeta = {
  garmentPool?: VtonGarmentItem[];
  lookDrafts?: VtonLookSpec[];
  tryonBatch?: VtonTryonBatchState | null;
  lockedLooks?: VtonLockedLook[];
  defaultLockedLookId?: string;
  tryonProgress?: VtonTryonProgress | null;
};

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
  };
}

export const VTON_LOOK_KIND_LABELS: Record<VtonLookKind, string> = {
  two_piece: "上下装",
  one_piece: "连体/裙",
  top_only: "仅上装",
  bottom_only: "仅下装",
  full_set: "套装",
};

export const VTON_GARMENT_KIND_LABELS: Record<VtonGarmentKind, string> = {
  top: "上装",
  bottom: "下装",
  one_piece: "连体/裙",
  full_set: "套装",
};

export const VTON_GARMENT_POOL_KINDS: VtonGarmentKind[] = [
  "top",
  "bottom",
  "one_piece",
  "full_set",
];
