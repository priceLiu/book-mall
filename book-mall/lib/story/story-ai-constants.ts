// story-web 三期 · AI 流水线共享常量
// 详见 ../../../story-web/docs/ai/plan.md

export const STORY_AI_KIE_MODELS = {
  IMAGE: "nano-banana-pro",
  // 默认视频模型（图生视频）。其它模型见 STORY_VIDEO_MODELS。
  VIDEO: "bytedance/seedance-2",
} as const;

/**
 * 可在前端选择的视频模型清单。每个模型暴露：
 *  - 是否需要参考图（image-to-video / text-to-video）
 *  - 用户可调参数及取值范围（前端以此渲染表单 + 后端做校验）
 *  - 各参数的默认值（前端默认值 + 后端兜底）
 *  - buildInput：把通用 options + frame 转成模型特定的 KIE input 形状
 *
 * 当前接入（均为图生视频，匹配漫剧分镜「先出图、再出视频」的工作流）：
 *   - bytedance/seedance-2      字节豆包  docs/kie/seedance-2.md
 *   - wan/2-7-image-to-video    阿里通义万相  docs/kie/wan 2.7 img 2 video.md
 *
 * 注意：之前曾误用 `wan/2-7-text-to-video`（文生视频，丢失分镜图一致性），已切换。
 */
export const STORY_VIDEO_MODEL_IDS = [
  "bytedance/seedance-2",
  "wan/2-7-image-to-video",
] as const;
export type StoryVideoModelId = (typeof STORY_VIDEO_MODEL_IDS)[number];

export type StoryVideoOptions = {
  resolution?: string;
  /** 视频时长（秒） */
  duration?: number;
  /** 是否生成 AI 配音；仅 seedance-2 支持 */
  generateAudio?: boolean;
  /** 是否启用 prompt 优化器；仅 wan/2-7-text-to-video 支持 */
  promptExtend?: boolean;
  /** 水印；仅 wan/2-7-text-to-video 支持 */
  watermark?: boolean;
};

export type StoryVideoModelDescriptor = {
  id: StoryVideoModelId;
  /** UI 显示名 */
  label: string;
  /** UI 副标题 */
  description: string;
  /** image-to-video 模型必须有 frame.imageUrl */
  requiresImage: boolean;
  resolutions: readonly string[];
  defaults: Required<
    Pick<StoryVideoOptions, "resolution" | "duration">
  > &
    Partial<StoryVideoOptions>;
  /** [min, max] 秒数 */
  durationRange: readonly [number, number];
  /** 模型支持哪些可调字段（用于前端渲染开关） */
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
    description: "字节豆包 · 图生视频，参考分镜图直接出片，画风一致性最好。",
    requiresImage: true,
    resolutions: ["480p", "720p", "1080p"] as const,
    defaults: { resolution: "1080p", duration: 5, generateAudio: false },
    durationRange: [4, 15] as const,
    supports: { generateAudio: true, promptExtend: false, watermark: false },
  },
  "wan/2-7-image-to-video": {
    id: "wan/2-7-image-to-video",
    label: "Wan 2.7",
    description:
      "阿里通义万相 · 图生视频，把分镜图作为首帧动起来；画风/构图保留度高。",
    requiresImage: true,
    resolutions: ["720p", "1080p"] as const,
    defaults: {
      resolution: "1080p",
      duration: 5,
      promptExtend: true,
      watermark: false,
    },
    durationRange: [2, 15] as const,
    supports: { generateAudio: false, promptExtend: true, watermark: true },
  },
};

export function getStoryVideoModel(
  id: string | null | undefined,
): StoryVideoModelDescriptor {
  if (id && (STORY_VIDEO_MODEL_IDS as readonly string[]).includes(id)) {
    return STORY_VIDEO_MODELS[id as StoryVideoModelId];
  }
  return STORY_VIDEO_MODELS[STORY_AI_KIE_MODELS.VIDEO];
}

export const STORY_AI_FRAME_COUNT_OPTIONS = [3, 5, 8] as const;
export type StoryAiFrameCount = (typeof STORY_AI_FRAME_COUNT_OPTIONS)[number];
export const STORY_AI_DEFAULT_FRAME_COUNT: StoryAiFrameCount = 5;

/** 任务超时阈值（分钟）：超过该时长仍未 SUCCEEDED 的 SUBMITTED 任务标记 FAILED('timeout') */
export const STORY_AI_TASK_TIMEOUT_MIN = 20;

/** 单用户进行中 (PENDING + SUBMITTED) 任务上限，避免异常脚本打满 KIE/OSS */
export function getStoryAiUserInflightMax(): number {
  const raw = Number(process.env.STORY_AI_USER_INFLIGHT_MAX ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

export function getStoryAiKieMaxConcurrency(): number {
  const raw = Number(process.env.STORY_AI_KIE_MAX_CONCURRENCY ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 10;
}

export function getStoryAiLlmMaxConcurrency(): number {
  // 旧名（OpenRouter 时代）兼容：STORY_AI_OPENROUTER_MAX_CONCURRENCY
  const raw = Number(
    process.env.STORY_AI_LLM_MAX_CONCURRENCY ??
      process.env.STORY_AI_OPENROUTER_MAX_CONCURRENCY ??
      "",
  );
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

/** 由 KIE 异步轮询/回调入口校验的 Bearer token */
export function getStoryAiPollToken(): string | null {
  const v = process.env.STORY_AI_POLL_TOKEN?.trim();
  return v ? v : null;
}

/** 由 KIE 回调 URL 携带的 ?token= 校验密钥 */
export function getStoryAiKieCallbackToken(): string | null {
  const v = process.env.KIE_CALLBACK_TOKEN?.trim();
  return v ? v : null;
}

/** 公网回调基址；为空时不下发 callBackUrl 给 KIE，纯靠 poll worker（决议 §13.6） */
export function getStoryAiPublicBase(): string | null {
  const v = process.env.STORY_AI_PUBLIC_BASE?.trim().replace(/\/$/, "");
  return v ? v : null;
}

export function buildStoryAiKieCallbackUrl(
  kind: "image" | "video",
  taskRef: string,
): string | null {
  const base = getStoryAiPublicBase();
  const token = getStoryAiKieCallbackToken();
  if (!base || !token) return null;
  const params = new URLSearchParams({ token, taskRef });
  return `${base}/api/story/kie/callback/${kind}?${params.toString()}`;
}

/** OSS key 命名 */
export type StoryOssKind =
  | "cover"
  | "character"
  | "frame-image"
  | "frame-video";

export function buildStoryOssKey(
  kind: StoryOssKind,
  args: { projectId: string; refId?: string; ext: string },
): string {
  const ext = args.ext.replace(/^\./, "").toLowerCase();
  const segments: string[] = ["story", kind, args.projectId];
  if (args.refId) segments.push(args.refId);
  segments.push(`${cryptoLikeId()}.${ext}`);
  return segments.join("/");
}

/** crypto.randomUUID 的服务端别名（避免在 client 路径误引） */
function cryptoLikeId(): string {
  return require("node:crypto").randomUUID();
}

/** 把 KIE 项目画幅枚举转为 KIE.AI 的 aspect_ratio 字符串 */
export function aspectRatioToKie(
  aspect: "RATIO_16_9" | "RATIO_9_16",
): "16:9" | "9:16" {
  return aspect === "RATIO_16_9" ? "16:9" : "9:16";
}

/** AspectRatio 字符串转 Prisma 枚举值 */
export function kieAspectToEnum(
  aspect: "16:9" | "9:16",
): "RATIO_16_9" | "RATIO_9_16" {
  return aspect === "16:9" ? "RATIO_16_9" : "RATIO_9_16";
}

/** 日志脱敏：把 ?token=xxx 替换为 ?token=*** */
export function maskTokenInUrl(url: string): string {
  return url.replace(/([?&]token=)[^&]+/g, "$1***");
}
