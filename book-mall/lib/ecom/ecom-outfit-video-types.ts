import type { WorkflowComposeResult, WorkflowRefs } from "@/lib/ecom/video-workflow/shot-spine";
import type { WorkflowEnvelope } from "@/lib/ecom/video-workflow/envelope";
import type { OutfitWorkflowPhase } from "@/lib/ecom/video-workflow/templates/outfit-v1/ui-config";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";

export const ECOM_OUTFIT_VIDEO_MODULE = "video-outfit";
export const ECOM_OUTFIT_VIDEO_TOOL_KEY = "ecom-toolkit__video-outfit";

export type OutfitRefMode = "already_dressed" | "need_tryon";
export type OutfitGarmentMode = "two_piece" | "one_piece";

export type OutfitVideoSettings = {
  videoModelKey?: string;
  splitModelKey?: string;
  /** 已穿搭：直接上传全身照；需穿衣：模特 + 服装后 AI 试衣 */
  outfitRefMode?: OutfitRefMode;
  /** 需穿衣时的服装形态（对齐试衣间 two_piece / one_piece） */
  garmentMode?: OutfitGarmentMode;
  fusionModelKey?: string;
  /** 用户自定义拆镜 System（§十中文 + 契约，不含英文前缀） */
  splitSystemPrompt?: string;
  /** 用户自定义拆镜 User（含交付格式；时间轴/截图仍由服务端追加） */
  splitUserPrompt?: string;
  lastSplitPrompt?: string;
};

export type OutfitSplitProgress = {
  phase: "prepare" | "detect" | "cut" | "analyze" | "finalize";
  step?: number;
  totalSteps?: number;
  label: string;
  updatedAt: string;
};

export type OutfitVideoProjectDto = {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: OutfitWorkflowPhase;
  settings: OutfitVideoSettings;
  references: WorkflowRefs;
  structured: Record<string, WorkflowEnvelope> | null;
  sceneList: SceneShot[];
  composeResult: WorkflowComposeResult | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type OutfitVideoProjectSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  phase: string;
  sceneCount: number;
};
