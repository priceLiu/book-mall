/**
 * 视频实验室 · 模型清单：`config/lab-video-models.json`
 * 默认模型由根对象 `defaults` 指定（`id` 须存在于对应列表）；未配置时取该列表第一项。
 */
import rawLabVideoModels from "@/config/lab-video-models.json";

export type ImageToVideoModelOption = {
  id: string;
  apiModel: string;
  title: string;
  description: string;
  icon: string;
  defaultParameters?: Record<string, unknown>;
};

export type TextToVideoModelOption = {
  id: string;
  apiModel: string;
  title: string;
  description: string;
  icon: string;
  defaultParameters?: Record<string, unknown>;
};

type LabVideoModelsFile = {
  defaults?: {
    imageToVideo?: unknown;
    textToVideo?: unknown;
    referenceToVideo?: unknown;
  };
  imageToVideo: unknown;
  textToVideo: unknown;
  referenceToVideo: unknown;
};

function resolveDefaultModelId(
  models: ImageToVideoModelOption[],
  configured: unknown,
  listKey: string,
): string {
  if (typeof configured === "string" && configured.trim()) {
    const id = configured.trim();
    if (!models.some((m) => m.id === id)) {
      throw new Error(
        `config/lab-video-models.json · defaults.${listKey} "${id}" must match an id in "${listKey}"`,
      );
    }
    return id;
  }
  return models[0]!.id;
}

function parseModelList(
  list: unknown,
  key: string,
): ImageToVideoModelOption[] {
  if (!Array.isArray(list) || list.length === 0) {
    throw new Error(
      `config/lab-video-models.json · "${key}" must be a non-empty array`,
    );
  }
  const out: ImageToVideoModelOption[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!item || typeof item !== "object") {
      throw new Error(
        `config/lab-video-models.json · "${key}[${i}]" must be an object`,
      );
    }
    const o = item as Record<string, unknown>;
    const id = o.id;
    const apiModel = o.apiModel;
    const title = o.title;
    const description = o.description;
    const icon = o.icon;
    if (
      typeof id !== "string" ||
      typeof apiModel !== "string" ||
      typeof title !== "string" ||
      typeof description !== "string" ||
      typeof icon !== "string"
    ) {
      throw new Error(
        `config/lab-video-models.json · "${key}[${i}]" needs string fields id, apiModel, title, description, icon`,
      );
    }
    const entry: ImageToVideoModelOption = {
      id,
      apiModel,
      title,
      description,
      icon,
    };
    if (o.defaultParameters !== undefined) {
      if (
        typeof o.defaultParameters !== "object" ||
        o.defaultParameters === null ||
        Array.isArray(o.defaultParameters)
      ) {
        throw new Error(
          `config/lab-video-models.json · "${key}[${i}].defaultParameters" must be an object`,
        );
      }
      entry.defaultParameters = o.defaultParameters as Record<string, unknown>;
    }
    out.push(entry);
  }
  return out;
}

const file = rawLabVideoModels as LabVideoModelsFile;

export const IMAGE_TO_VIDEO_MODELS = parseModelList(
  file.imageToVideo,
  "imageToVideo",
);

export const REFERENCE_TO_VIDEO_MODELS = parseModelList(
  file.referenceToVideo,
  "referenceToVideo",
);

export const TEXT_TO_VIDEO_MODELS = parseModelList(
  file.textToVideo,
  "textToVideo",
) as TextToVideoModelOption[];

export const DEFAULT_IMAGE_TO_VIDEO_MODEL_ID = resolveDefaultModelId(
  IMAGE_TO_VIDEO_MODELS,
  file.defaults?.imageToVideo,
  "imageToVideo",
);

const byApiModel = new Map(
  IMAGE_TO_VIDEO_MODELS.map((m) => [m.apiModel, m] as const),
);

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

const byRefApiModel = new Map(
  REFERENCE_TO_VIDEO_MODELS.map((m) => [m.apiModel, m] as const),
);

export const DEFAULT_REFERENCE_TO_VIDEO_MODEL_ID = resolveDefaultModelId(
  REFERENCE_TO_VIDEO_MODELS,
  file.defaults?.referenceToVideo,
  "referenceToVideo",
);

export function getReferenceToVideoModelById(
  id: string,
): ImageToVideoModelOption | undefined {
  return REFERENCE_TO_VIDEO_MODELS.find((m) => m.id === id);
}

export function getReferenceToVideoModelByApiModel(
  apiModel: string,
): ImageToVideoModelOption | undefined {
  const k = apiModel.trim();
  return k ? byRefApiModel.get(k) : undefined;
}

export const DEFAULT_TEXT_TO_VIDEO_MODEL_ID = resolveDefaultModelId(
  TEXT_TO_VIDEO_MODELS,
  file.defaults?.textToVideo,
  "textToVideo",
);

const byT2vApi = new Map(
  TEXT_TO_VIDEO_MODELS.map((m) => [m.apiModel, m] as const),
);

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

/** 实验室「清晰度」→ Wan 文生视频 `size`（16:9 横屏） */
export function resolutionToT2vSize(
  resolution: "720P" | "1080P",
): string {
  return resolution === "720P" ? "1280*720" : "1920*1080";
}

/** 文生视频实验室：宽高比（HappyHorse 文档含 4:5、5:4，万相 size 同步映射） */
export const T2V_ASPECT_RATIO_OPTIONS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "4:5",
  "5:4",
] as const;

export type T2vAspectRatio = (typeof T2V_ASPECT_RATIO_OPTIONS)[number];

const T2V_ASPECT_TO_SIZE: Record<
  T2vAspectRatio,
  readonly [string, string]
> = {
  "16:9": ["1280*720", "1920*1080"],
  "9:16": ["720*1280", "1080*1920"],
  "1:1": ["720*720", "1080*1080"],
  "4:3": ["960*720", "1440*1080"],
  "3:4": ["720*960", "1080*1440"],
  "4:5": ["720*900", "1080*1350"],
  "5:4": ["900*720", "1350*1080"],
};

export function t2vAspectRatioToSize(
  aspect: string,
  resolution: "720P" | "1080P",
): string {
  const k = aspect.trim() as T2vAspectRatio;
  const pair = T2V_ASPECT_TO_SIZE[k] ?? T2V_ASPECT_TO_SIZE["16:9"];
  return resolution === "1080P" ? pair[1]! : pair[0]!;
}
