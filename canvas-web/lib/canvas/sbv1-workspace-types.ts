import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "./system-providers";

export type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";

export type Sbv1AspectRatio =
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
  /** 底部 / 内嵌输入坞 prompt（@ 引用上游） */
  dockInput?: string;
  dockStyleRef?: {
    presetId: string;
    name: string;
    prompt: string;
    imageUrl: string;
  };
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
  /** 真人人像库 · H5 活体通过后 GroupId */
  realPersonGroupId?: string;
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
    params: { resolution: "720p", generate_audio: true },
  },
  aspectRatio: "4:3",
  durationSec: 5,
  resolution: "720p",
  refSlots: [],
};
