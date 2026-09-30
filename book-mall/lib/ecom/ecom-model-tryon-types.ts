import type { WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import type { VtonGarmentMode, VtonProjectMeta, VtonRefMode } from "@/lib/ecom/ecom-vton/types";

export const ECOM_MODEL_TRYON_MODULE = "model-tryon";
export const ECOM_MODEL_TRYON_TOOL_KEY = "ecom-toolkit__model-tryon";
export const MODEL_TRYON_V1_TEMPLATE_ID = "model-tryon-v1";

export type ModelTryonSettings = {
  outfitRefMode?: VtonRefMode;
  garmentMode?: VtonGarmentMode;
  /** 全身生图 / 扩全身 · 像素尺寸或 1K/2K 档位 */
  modelImageSize?: string;
  /** 全身生图 / 扩全身 · 出图比例 */
  modelGenRatio?: string;
  /** 全身生图 / 扩全身 · Gateway 图片模型 */
  modelGenModelKey?: string;
  modelBodyPreset?: string;
  modelAgeGroup?: string;
  modelFeatureDetail?: string;
  modelHeightCm?: string;
  modelWeightKg?: string;
  modelBustCm?: string;
  modelWaistCm?: string;
  modelHipsCm?: string;
  /** 文生试衣 · 图片编辑模型 */
  textTryonModelKey?: string;
  /** 文生试衣 · 出图像素尺寸 */
  textTryonImageSize?: string;
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
