import type { ComposeWorkbenchState } from "@private/platform-compose-ui/types";

import type {
  Sbv1ImageAspectRatio,
  Sbv1ImageQuality,
  Sbv1ImageResolution,
} from "./sbv1-image-models";
import { buildSbv1ImageEngineParams } from "./sbv1-image-models";
import type { StoryRefImage } from "./story-ref-image";
import type { CanvasEnginePick, CanvasNodeRuntime } from "./types";
import { GATEWAY_BAILIAN_PROVIDER_ID } from "./system-providers";

export type Sbv1ReferenceMode = "omni" | "first_last" | "smart_multi";

/** 视频节点 · 截帧 Dock / 剪辑迷你窗（compose-trim，打开时隐藏生成 Dock） */
export type Sbv1VideoEditSession =
  | { open: false }
  | { open: true; mode: "pick-frame" | "compose-trim" };

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
  aspectRatio: "16:9",
  imageQuality: "standard",
  resolution: "2K",
  outputCount: 1,
  engine: {
    providerId: "",
    modelKey: "nano-banana-pro",
    params: buildSbv1ImageEngineParams({ aspectRatio: "16:9" }),
  },
};

export type Sbv1VideoEngineNodeData = {
  label?: string;
  prompt: string;
  /** 与 prompt 同步 · 浮动 Dock 编辑用 */
  dockInput?: string;
  creationType: Sbv1CreationType;
  referenceMode: Sbv1ReferenceMode;
  jimengModelId?: string;
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
  /** 快捷预设 · 专业拉片 */
  pro2PresetKind?: string;
  filmPullProjectId?: string;
  filmPullScriptHubId?: string;
  videoEditSession?: Sbv1VideoEditSession;
  /**
   * @deprecated 使用 composeTrimWorkbenchDraft / composeTrimWorkbenchCommitted
   */
  composeTrimWorkbench?: ComposeWorkbenchState | null;
  /** 全屏剪辑 · 当前编辑草稿（未合成前不影响迷你窗时间线） */
  composeTrimWorkbenchDraft?: ComposeWorkbenchState | null;
  /** 迷你窗时间线 · 与最后一次「生成剪辑片段」成功时一致 */
  composeTrimWorkbenchCommitted?: ComposeWorkbenchState | null;
  /** 最近一次「生成剪辑片段」产出的右侧结果节点 id */
  lastComposeTrimResultNodeId?: string | null;
  /** 本地 ffmpeg 裁剪 · 入出点与实测时长 */
  trimClipMeta?: {
    startSec: number;
    endSec: number;
    durationSec: number;
  };
};

export const SBV1_DEFAULT_VIDEO_ENGINE_DATA: Sbv1VideoEngineNodeData = {
  prompt: "",
  creationType: "video",
  referenceMode: "omni",
  engine: {
    providerId: GATEWAY_BAILIAN_PROVIDER_ID,
    modelKey: "happyhorse-1.1-t2v",
    params: { ratio: "16:9", resolution: "720P", duration: 15 },
  },
  aspectRatio: "16:9",
  durationSec: 15,
  resolution: "720p",
  refSlots: [],
};
