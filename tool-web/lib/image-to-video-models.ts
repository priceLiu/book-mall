/**
 * 图生视频 · 可选模型清单（实验室 UI + /api/image-to-video/start 白名单）
 * 维护方式：增删条目、修改 apiModel 与控制台模型名对齐即可。
 */

export type ImageToVideoModelOption = {
  id: string;
  /** DashScope 请求体中的 `model` 字段，须与百炼控制台一致 */
  apiModel: string;
  title: string;
  description: string;
  /** 列表与触发器上展示的图标（Emoji 即可） */
  icon: string;
  /** 与 resolution / duration / watermark / seed 合并后传给 parameters */
  defaultParameters?: Record<string, unknown>;
};

export const IMAGE_TO_VIDEO_MODELS: ImageToVideoModelOption[] = [
  {
    id: "happyhorse-1-0-i2v",
    apiModel: "happyhorse-1.0-i2v",
    title: "HappyHorse-1.0-I2V",
    description: "首帧图生视频，运动自然，Happy Horse 系列。",
    icon: "🎠",
  },
  {
    id: "wan27-i2v-2026-04-25",
    apiModel: "wan2.7-i2v-2026-04-25",
    title: "万相2.7-图生视频-2026-04-25",
    description: "万相 2.7 新版协议，首帧引导，推荐优先选用。",
    icon: "✦",
    defaultParameters: { prompt_extend: true },
  },
  {
    id: "wan27-i2v",
    apiModel: "wan2.7-i2v",
    title: "万相2.7-图生视频",
    description: "万相 2.7 图生视频；名称以控制台为准时可改 apiModel。",
    icon: "✦",
    defaultParameters: { prompt_extend: true },
  },
  {
    id: "wan26-i2v-flash",
    apiModel: "wan2.6-i2v-flash",
    title: "wan2.6-I2V-flash",
    description: "更快出片，适合试错（以控制台实际可用模型为准）。",
    icon: "✦",
    defaultParameters: { prompt_extend: true },
  },
  {
    id: "wan26-i2v",
    apiModel: "wan2.6-i2v",
    title: "Wan2.6-I2V",
    description: "万相 2.6 图生视频。",
    icon: "✦",
    defaultParameters: { prompt_extend: true },
  },
  {
    id: "wan25-i2v-preview",
    apiModel: "wan2.5-i2v-preview",
    title: "Wan2.5-I2V-Preview",
    description: "万相 2.5 预览版。",
    icon: "✦",
    defaultParameters: { prompt_extend: true },
  },
  {
    id: "pixverse-c1-it2v",
    apiModel: "pixverse-c1-it2v",
    title: "PixVerse-C1-it2v",
    description: "PixVerse 图生视频；若与当前 endpoint 不兼容请改 apiModel 或移除此项。",
    icon: "P",
  },
];

const byApiModel = new Map(
  IMAGE_TO_VIDEO_MODELS.map((m) => [m.apiModel, m] as const),
);

export const DEFAULT_IMAGE_TO_VIDEO_MODEL_ID = IMAGE_TO_VIDEO_MODELS[0]!.id;

export function getImageToVideoModelById(
  id: string,
): ImageToVideoModelOption | undefined {
  return IMAGE_TO_VIDEO_MODELS.find((m) => m.id === id);
}

export function getImageToVideoModelByApiModel(
  apiModel: string,
): ImageToVideoModelOption | undefined {
  const k = apiModel.trim();
  return k ? byApiModel.get(k) : undefined;
}

/** 文生视频（Wan t2v），请求体使用 `size` + `input.prompt` */
export type TextToVideoModelOption = {
  id: string;
  apiModel: string;
  title: string;
  description: string;
  icon: string;
  defaultParameters?: Record<string, unknown>;
};

export const TEXT_TO_VIDEO_MODELS: TextToVideoModelOption[] = [
  {
    id: "wan25-t2v-preview",
    apiModel: "wan2.5-t2v-preview",
    title: "Wan2.5-文生视频-Preview",
    description: "纯文本生成视频；时长多为 5 秒或 10 秒（以控制台为准）。",
    icon: "✦",
    defaultParameters: { prompt_extend: true },
  },
];

const byT2vApi = new Map(
  TEXT_TO_VIDEO_MODELS.map((m) => [m.apiModel, m] as const),
);

export const DEFAULT_TEXT_TO_VIDEO_MODEL_ID = TEXT_TO_VIDEO_MODELS[0]!.id;

export function getTextToVideoModelById(
  id: string,
): TextToVideoModelOption | undefined {
  return TEXT_TO_VIDEO_MODELS.find((m) => m.id === id);
}

export function getTextToVideoModelByApiModel(
  apiModel: string,
): TextToVideoModelOption | undefined {
  const k = apiModel.trim();
  return k ? byT2vApi.get(k) : undefined;
}

/** 实验室「清晰度」→ Wan 文生视频 `size` */
export function resolutionToT2vSize(
  resolution: "720P" | "1080P",
): string {
  return resolution === "720P" ? "1280*720" : "1920*1080";
}
