/**
 * 前端用的视频模型清单（与 book-mall/lib/story/story-ai-constants.ts 中的 STORY_VIDEO_MODELS 对应）。
 * 后端是真理之源；这里只用于渲染表单，最终由 backend 校验。
 */
import type {
  StoryVideoModelId,
  StoryVideoOptions,
} from "@/lib/projects/api";

export type StoryVideoModelDescriptor = {
  id: StoryVideoModelId;
  label: string;
  description: string;
  /** 是否需要 frame.imageUrl（image-to-video） */
  requiresImage: boolean;
  resolutions: readonly string[];
  defaults: Required<Pick<StoryVideoOptions, "resolution" | "duration">> &
    Partial<StoryVideoOptions>;
  durationRange: readonly [number, number];
  supports: {
    generateAudio: boolean;
    promptExtend: boolean;
    watermark: boolean;
  };
};

export const STORY_VIDEO_MODELS: Record<
  StoryVideoModelId,
  StoryVideoModelDescriptor
> = {
  "bytedance/seedance-2": {
    id: "bytedance/seedance-2",
    label: "Seedance 2",
    description:
      "字节豆包 · 图生视频，参考分镜图直接出片，画风一致性最好。",
    requiresImage: true,
    resolutions: ["480p", "720p", "1080p"],
    defaults: { resolution: "1080p", duration: 5, generateAudio: false },
    durationRange: [4, 15],
    supports: { generateAudio: true, promptExtend: false, watermark: false },
  },
  "wan/2-7-image-to-video": {
    id: "wan/2-7-image-to-video",
    label: "Wan 2.7",
    description:
      "阿里通义万相 · 图生视频，把分镜图作为首帧动起来；画风/构图保留度高。",
    requiresImage: true,
    resolutions: ["720p", "1080p"],
    defaults: {
      resolution: "1080p",
      duration: 5,
      promptExtend: true,
      watermark: false,
    },
    durationRange: [2, 15],
    supports: { generateAudio: false, promptExtend: true, watermark: true },
  },
  "happyhorse/image-to-video": {
    id: "happyhorse/image-to-video",
    label: "Happy Horse",
    description:
      "Happy Horse · 图生视频，性价比高的备选；画风偏写实/影视感。",
    requiresImage: true,
    resolutions: ["720p", "1080p"],
    defaults: { resolution: "1080p", duration: 5 },
    durationRange: [3, 15],
    supports: { generateAudio: false, promptExtend: false, watermark: false },
  },
};

export const STORY_VIDEO_MODEL_LIST: StoryVideoModelDescriptor[] = [
  STORY_VIDEO_MODELS["bytedance/seedance-2"],
  STORY_VIDEO_MODELS["wan/2-7-image-to-video"],
  STORY_VIDEO_MODELS["happyhorse/image-to-video"],
];

export function getStoryVideoModel(
  id: string | null | undefined,
): StoryVideoModelDescriptor {
  if (id && id in STORY_VIDEO_MODELS) {
    return STORY_VIDEO_MODELS[id as StoryVideoModelId];
  }
  return STORY_VIDEO_MODELS["bytedance/seedance-2"];
}

/**
 * 历史使用过、现已下线的模型 id → 友好显示名。
 * 用于在分镜卡片上正确标记早期生成的视频出处，
 * 避免被 fallback 成默认模型的 label。
 */
const LEGACY_VIDEO_MODEL_LABELS: Record<string, string> = {
  "wan/2-7-image-pro": "Wan 2.7 (image-pro · 已弃)",
  "wan/2-7-text-to-video": "Wan 2.7 (text2video · 已弃)",
};

/**
 * 给定一个 model id，返回卡片上要展示的 label：
 *  - 命中当前注册表 → 用注册表的 label
 *  - 命中历史表 → 用历史 label
 *  - 都不命中 → 原样返回 id（不至于显示成误导性的默认模型名）
 */
export function getStoryVideoModelLabel(
  id: string | null | undefined,
): string | null {
  if (!id) return null;
  if (id in STORY_VIDEO_MODELS) {
    return STORY_VIDEO_MODELS[id as StoryVideoModelId].label;
  }
  return LEGACY_VIDEO_MODEL_LABELS[id] ?? id;
}

/** 把 ms 转成 "12.3 s" 形式 */
export function formatCostMs(ms: number | null | undefined): string | null {
  if (ms == null || !Number.isFinite(ms)) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
