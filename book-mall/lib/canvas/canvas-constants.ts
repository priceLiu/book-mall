// canvas-web AI 海报画布共享常量。详见 canvas-web/docs/plan.md

export const CANVAS_AI_TASK_TIMEOUT_MIN = 20;

/** 单用户进行中 (PENDING + SUBMITTED) 任务上限 */
export function getCanvasUserInflightMax(): number {
  const raw = Number(process.env.CANVAS_AI_USER_INFLIGHT_MAX ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

/**
 * 单画布项目并发上限（前端运行队列 + 后端校验）。
 * 默认 0 = 不限制；设为正整数则启用上限。
 */
export function getCanvasProjectInflightMax(): number {
  const raw = Number(process.env.CANVAS_PROJECT_INFLIGHT_MAX ?? "");
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw;
}

/** 由 KIE 异步轮询入口校验的 Bearer token（沿用 story 的） */
export function getCanvasAiPollToken(): string | null {
  const v =
    process.env.CANVAS_AI_POLL_TOKEN?.trim() ??
    process.env.STORY_AI_POLL_TOKEN?.trim();
  return v ? v : null;
}

/** 由 KIE 回调 URL 携带的 ?token= 校验密钥 */
export function getCanvasAiKieCallbackToken(): string | null {
  const v =
    process.env.CANVAS_KIE_CALLBACK_TOKEN?.trim() ??
    process.env.KIE_CALLBACK_TOKEN?.trim();
  return v ? v : null;
}

export function getCanvasAiPublicBase(): string | null {
  const v =
    process.env.CANVAS_AI_PUBLIC_BASE?.trim().replace(/\/$/, "") ??
    process.env.STORY_AI_PUBLIC_BASE?.trim().replace(/\/$/, "");
  return v ? v : null;
}

export function buildCanvasAiKieCallbackUrl(
  kind: "image" | "text",
  taskRef: string,
): string | null {
  const base = getCanvasAiPublicBase();
  const token = getCanvasAiKieCallbackToken();
  if (!base || !token) return null;
  const params = new URLSearchParams({ token, taskRef });
  return `${base}/api/canvas/kie/callback/${kind}?${params.toString()}`;
}

/** OSS key 命名 */
export type CanvasOssKind = "node-image" | "node-output" | "user-upload";

export function buildCanvasOssKey(
  kind: CanvasOssKind,
  args: { projectId?: string; userId?: string; ext: string },
): string {
  const ext = args.ext.replace(/^\./, "").toLowerCase();
  const segments: string[] = ["canvas", kind];
  if (args.projectId) segments.push(args.projectId);
  if (args.userId) segments.push(args.userId);
  segments.push(`${cryptoLikeId()}.${ext}`);
  return segments.join("/");
}

function cryptoLikeId(): string {
  return require("node:crypto").randomUUID();
}

/** 内置画布模型种子（在 admin UI 之前用于 fallback） */
export const CANVAS_BUILTIN_MODELS = [
  {
    modelKey: "nano-banana-pro",
    displayName: "Nano Banana Pro",
    vendor: "google/nano-banana",
    role: "IMAGE" as const,
    description: "通用图像生成 / 风格融合，支持多张参考图，画风稳定。",
    sortOrder: 1,
    defaultParams: { aspect_ratio: "1:1", resolution: "2K", output_format: "png" },
  },
  {
    modelKey: "flux-2-pro",
    displayName: "Flux-2 Pro",
    vendor: "black-forest-labs/flux-2",
    role: "IMAGE" as const,
    description: "Flux-2 Pro 高质量写实文生图。",
    sortOrder: 2,
    defaultParams: { aspect_ratio: "1:1", resolution: "2K" },
  },
  {
    modelKey: "seedream-5-lite",
    displayName: "Seedream 5.0 Lite",
    vendor: "bytedance/seedream",
    role: "IMAGE" as const,
    description: "Seedream 5 Lite 写实文生图。",
    sortOrder: 3,
    defaultParams: { aspect_ratio: "1:1", quality: "basic" },
  },
  {
    modelKey: "seedream-4.5",
    displayName: "Seedream 4.5",
    vendor: "bytedance/seedream",
    role: "IMAGE" as const,
    description: "Seedream 4.5 高质量写实文生图。",
    sortOrder: 4,
    defaultParams: { aspect_ratio: "1:1", quality: "basic" },
  },
  {
    modelKey: "gpt-image-2",
    displayName: "GPT Image 2",
    vendor: "openai",
    role: "IMAGE" as const,
    description: "GPT Image 2 · 海报 / 排版。",
    sortOrder: 5,
    defaultParams: { aspect_ratio: "1:1", resolution: "2K" },
  },
  {
    modelKey: "gpt-image-1",
    displayName: "GPT Image 1.5",
    vendor: "openai",
    role: "IMAGE" as const,
    description: "GPT Image 1.5 · 排版 / 平面海报。",
    sortOrder: 6,
    defaultParams: { aspect_ratio: "1:1", quality: "medium" },
  },
  {
    modelKey: "qwen-text-to-image",
    displayName: "Qwen 文生图",
    vendor: "alibaba/qwen",
    role: "IMAGE" as const,
    description: "通义 Qwen 写实文生图。",
    sortOrder: 7,
    defaultParams: { aspect_ratio: "1:1", output_format: "png" },
  },
];

export type CanvasBuiltinModel = (typeof CANVAS_BUILTIN_MODELS)[number];
