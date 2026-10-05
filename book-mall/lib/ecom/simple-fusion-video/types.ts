import type { WorkflowComposeResult } from "@/lib/ecom/video-workflow/shot-spine";

import type { SimpleFusionComposeWorkbenchState } from "./compose-workbench";
import type { SimpleFusionVariant } from "./constants";

export type SimpleFusionRefImage = {
  ossUrl: string;
  source?: "upload" | "library" | "asset" | "text";
  label?: string;
  firstOrigin?: string;
};

export type SimpleFusionSceneRef = {
  ossUrl?: string;
  scenePrompt?: string;
  libraryEntryId?: string;
  libraryEntryName?: string;
  source?: "upload" | "library" | "text" | "asset";
  firstOrigin?: string;
};

export type SimpleFusionGarmentRef = {
  id: string;
  ossUrl: string;
  label?: string;
  firstOrigin?: string;
};

export type SimpleFusionReferences = {
  model?: SimpleFusionRefImage;
  scene?: SimpleFusionSceneRef;
  garments?: SimpleFusionGarmentRef[];
};

export type SimpleFusionPrompts = {
  fusion?: string;
  video?: string;
  negative?: string;
};

export type SimpleFusionLook = {
  lookId: string;
  garmentId: string;
  fusedImageUrl?: string;
  clipVideoUrl?: string;
  /** 口播文案（③ 区或 look 级预填，合并进 clip.subtitle） */
  voiceover?: string;
  /** Look 级 TTS（合并进 clip.audioUrl，用户轨内编辑优先保留） */
  ttsUrl?: string;
  status?: "pending" | "fusing" | "fusion_failed" | "fused" | "generating" | "success" | "failed";
  failReason?: string;
};

export type SimpleFusionSettings = {
  variant?: SimpleFusionVariant;
  fusionModelKey?: string;
  videoModelKey?: string;
  /** 单镜图生视频时长（秒），HappyHorse 等 panel 模型 3–15s */
  panelDurationSec?: number;
  bgmPresetId?: string;
};

export type SimpleFusionProjectDto = {
  id: string;
  title: string | null;
  module: string;
  templateId: string;
  status: string;
  phase: string;
  settings: SimpleFusionSettings;
  references: SimpleFusionReferences;
  composeResult: WorkflowComposeResult | null;
  meta: {
    prompts?: SimpleFusionPrompts;
    looks?: SimpleFusionLook[];
    deliverableSnapshot?: unknown;
    deliverableSnapshotHistory?: unknown[];
    renderJobId?: string;
    composeWorkbench?: SimpleFusionComposeWorkbenchState;
    renderFailReason?: string;
    [key: string]: unknown;
  } | null;
  createdAt: string;
  updatedAt: string;
};

export type SimpleFusionProjectSummary = {
  id: string;
  title: string | null;
  updatedAt: string;
  phase: string;
};
