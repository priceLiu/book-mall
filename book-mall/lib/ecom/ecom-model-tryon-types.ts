import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import type { VtonGarmentMode, VtonProjectMeta, VtonRefMode } from "@/lib/ecom/ecom-vton/types";

export const ECOM_MODEL_TRYON_MODULE = "model-tryon";
export const ECOM_MODEL_TRYON_TOOL_KEY = "ecom-toolkit__model-tryon";
export const MODEL_TRYON_V1_TEMPLATE_ID = "model-tryon-v1";

export type ModelTryonSettings = {
  outfitRefMode?: VtonRefMode;
  garmentMode?: VtonGarmentMode;
  imageModelKey?: string;
  fusionModelKey?: string;
};

export type ModelTryonProjectDto = {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: ModelTryonSettings;
  references: WorkflowRefs;
  meta: VtonProjectMeta | null;
  createdAt: string;
  updatedAt: string;
};

export type ModelTryonProjectSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
};
