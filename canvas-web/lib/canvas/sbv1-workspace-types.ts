import type {
  Sbv1ImageAspectRatio,
  Sbv1ImageQuality,
  Sbv1ImageResolution,
} from "./sbv1-image-models";
import { buildSbv1ImageEngineParams } from "./sbv1-image-models";
import type { StoryRefImage } from "./story-ref-image";
import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import { GATEWAY_SBV1_VOLCENGINE_PROVIDER_ID } from "./system-providers";

export type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";

export type Sbv1DockInputMode = "t2v" | "i2v" | "first_last" | "omni" | "multi_ref";

export type Sbv1AspectRatio =
  | "auto"
  | "21:9"
  | "16:9"
  | "4:3"
  | "1:1"
  | "3:4"
  | "9:16";

export type Sbv1CreationType = "video" | "hd-video";

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
  /** Dock 粘贴的参考图（@ 引用） */
  dockRefImages?: StoryRefImage[];
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
  dockRefImages: [],
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
  /** 与 prompt 同步 · 浮动 Dock 编辑用 */
  dockInput?: string;
  creationType: Sbv1CreationType;
  referenceMode: Sbv1ReferenceMode;
  jimengModelId: string;
  /** Gateway 展示变体 id（优先于 jimengModelId） */
  volcengineVariantId?: string;
  engine: CanvasEnginePick;
  aspectRatio: Sbv1AspectRatio;
  durationSec: number;
  resolution: "720p" | "1080p" | "2k" | "4k";
  refSlots: Sbv1RefSlot[];
  /** Dock 顶栏输入模式（文生视频 / 图生视频 / 首尾帧…） */
  dockInputMode?: Sbv1DockInputMode;
  /** 火山私域人像库 asset://（LibTV 图片节点入库后写入） */
  portraitKind?: "virtual" | "real";
  portraitAssetId?: string;
  portraitAssetUri?: string;
  portraitStatus?: "pending" | "active" | "failed";
  portraitGroupId?: string;
  portraitImportMessage?: string;
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
