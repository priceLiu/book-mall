/** 合成台 · 客户端可安全引用的类型与常量（不含 prisma） */

/** wan2.2-s2v 音频硬限制：时长 < 20 秒（入口即校验，避免无效厂商调用） */
export const AI_SPACE_S2V_MAX_AUDIO_SEC = 20;

/** 厂商「同时处理中任务数」为 1，需平台侧单飞排队 */
export const AI_SPACE_S2V_VENDOR_CONCURRENCY = 1;

export const AI_SPACE_COMPOSE_STATUSES = [
  "pending",
  "generating_human",
  "composing",
  "completed",
  "failed",
] as const;

export type AiSpaceComposeStatus = (typeof AI_SPACE_COMPOSE_STATUSES)[number];

export const AI_SPACE_COMPOSE_STATUS_LABEL: Record<string, string> = {
  pending: "排队中",
  generating_human: "生成口播视频",
  composing: "画中画合成",
  completed: "已完成",
  failed: "失败",
};

export type AiSpaceComposeOverlayOptions = {
  scale: number;
  position: "bottom-right" | "bottom-left" | "top-right" | "top-left" | "center";
  marginPx: number;
  /** 烧录台词字幕 */
  burnSubtitle: boolean;
  resolution: "480P" | "720P";
};

export const AI_SPACE_COMPOSE_DEFAULT_OPTIONS: AiSpaceComposeOverlayOptions = {
  scale: 0.35,
  position: "bottom-right",
  marginPx: 20,
  burnSubtitle: false,
  resolution: "480P",
};

export type AiSpaceComposeTaskDto = {
  id: string;
  status: string;
  statusLabel: string;
  digitalHumanId: string;
  audioAssetId: string;
  videoMaterialId: string | null;
  tempHumanVideoUrl: string | null;
  finalVideoUrl: string | null;
  errorMessage: string | null;
  gatewayLogId: string | null;
  /** 0–100，合成阶段取 MediaRenderJob 进度 */
  progress: number;
  createdAt: string;
  updatedAt: string;
};
