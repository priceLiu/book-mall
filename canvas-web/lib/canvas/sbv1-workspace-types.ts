import type {
  Sbv1ImageAspectRatio,
  Sbv1ImageQuality,
  Sbv1ImageResolution,
} from "./sbv1-image-models";
import { buildSbv1ImageEngineParams } from "./sbv1-image-models";
import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "./system-providers";

export type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";

export type Sbv1AspectRatio =
  | "auto"
  | "21:9"
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16";

export type Sbv1CreationType = "video";

export type Sbv1RefSlot = {
  slotId: string;
  imageNodeId?: string;
  ossUrl?: string;
  blobUrl?: string;
};

export type Sbv1ImageNodeData = {
  label?: string;
  imageMode?: "txt2img" | "img2img" | "upload";
  ossUrl?: string;
  blobUrl?: string;
  uploading?: boolean;
  uploadError?: string;
  /** 生图任务状态（与 ImageNodeData 一致） */
  runtime?: CanvasNodeRuntime;
  /** 底部 / 内嵌输入坞 prompt（@ 引用上游） */
  dockInput?: string;
  dockStyleRef?: {
    presetId: string;
    name: string;
    prompt: string;
    imageUrl: string;
  };
  engine?: CanvasEnginePick;
  aspectRatio?: Sbv1ImageAspectRatio;
  imageQuality?: Sbv1ImageQuality;
  resolution?: Sbv1ImageResolution;
  outputCount?: number;
};

export const SBV1_DEFAULT_IMAGE_NODE_DATA: Sbv1ImageNodeData = {
  label: "图片",
  dockInput: "",
  aspectRatio: "auto",
  imageQuality: "standard",
  resolution: "2K",
  outputCount: 1,
  engine: {
    providerId: "",
    modelKey: "nano-banana-pro",
    params: buildSbv1ImageEngineParams({}),
  },
};

export type Sbv1VideoEngineNodeData = {
  prompt: string;
  creationType: Sbv1CreationType;
  referenceMode: Sbv1ReferenceMode;
  jimengModelId: string;
  /** Gateway 展示变体 id（优先于 jimengModelId） */
  volcengineVariantId?: string;
  engine: CanvasEnginePick;
  aspectRatio: Sbv1AspectRatio;
  durationSec: number;
  resolution: "720p" | "1080p";
  refSlots: Sbv1RefSlot[];
  /** @deprecated 账号级 sbv1PortraitGroupId（User 表）；节点字段仅兼容旧画布 */
  realPersonGroupId?: string;
  /** @deprecated 见 User.sbv1PortraitLivenessAt */
  realPersonLivenessAt?: string;
  runtime?: CanvasNodeRuntime;
  uploading?: boolean;
};

export const SBV1_DEFAULT_VIDEO_ENGINE_DATA: Sbv1VideoEngineNodeData = {
  prompt: "",
  creationType: "video",
  referenceMode: "omni",
  jimengModelId: "seedance-2-720p-audio-real",
  volcengineVariantId: "seedance-2-720p-audio-real",
  engine: {
    providerId: GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID,
    modelKey: "doubao-seedance-2.0",
    params: { resolution: "720p", generate_audio: true, duration: 15 },
  },
  aspectRatio: "4:3",
  durationSec: 15,
  resolution: "720p",
  refSlots: [],
};
