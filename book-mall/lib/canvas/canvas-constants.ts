// canvas-web AI 海报画布共享常量。详见 canvas-web/docs/plan.md

export const CANVAS_AI_TASK_TIMEOUT_MIN = 20;

/** 火山 Seedance 等长视频（15s + 参考图 + 音频）实测可超过 20min，单独放宽。 */
export function getCanvasVolcengineVideoTimeoutMin(): number {
  const raw = Number(process.env.CANVAS_VOLCENGINE_VIDEO_TIMEOUT_MIN ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 45;
}

export function isCanvasVolcengineVideoTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.providerKind !== "VOLCENGINE") return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

export function getCanvasMinimaxVideoTimeoutMin(): number {
  const raw = Number(process.env.CANVAS_MINIMAX_VIDEO_TIMEOUT_MIN ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 45;
}

export function isCanvasMinimaxVideoTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.providerKind !== "MINIMAX") return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

/** 百炼参考生视频（HappyHorse / 万相 R2V）实测可超过 20min，单独放宽。 */
export function getCanvasBailianR2vVideoTimeoutMin(): number {
  const raw = Number(process.env.CANVAS_BAILIAN_R2V_VIDEO_TIMEOUT_MIN ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 30;
}

export function isCanvasBailianR2vVideoTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.providerKind !== "BAILIAN_R2V") return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

/** KIE 异步视频（kling / veo / seedance 等 · sbv1 / Pro2 video-engine） */
export function isCanvasKieVideoTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.providerKind !== "KIE") return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

/** SUBMITTED 百炼 R2V 轮询间隔（DashScope 建议约 15s，避免 3s 频繁 recordInfo）。 */
export const CANVAS_BAILIAN_R2V_POLL_INTERVAL_MS = 15_000;

/** DashScope 异步视频（万相 / Kling 等 · wan3.0-video）实测可超过 20min。 */
export function getCanvasDashscopeVideoTimeoutMin(): number {
  const raw = Number(process.env.CANVAS_DASHSCOPE_VIDEO_TIMEOUT_MIN ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 45;
}

export function isCanvasDashscopeVideoTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.providerKind !== "DASHSCOPE") return false;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  return kind === "video-engine" || kind === "ai-video-engine";
}

/** KIE 异步视频轮询上限（与火山对齐，默认 45min）。 */
export function getCanvasKieVideoTimeoutMin(): number {
  const raw = Number(process.env.CANVAS_KIE_VIDEO_TIMEOUT_MIN ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 45;
}

/** 已进入后台生成后的画布轮询硬上限（Gateway STALE_TIMEOUT 对齐，默认 90min）。 */
export function getCanvasBackgroundVideoTimeoutMin(): number {
  const raw = Number(process.env.CANVAS_BACKGROUND_VIDEO_TIMEOUT_MIN ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 90;
}

/** DashScope 同步 multimodal 出图（qwen-image-3.0-pro / z-image-turbo / qwen-image-edit*） */
export function isCanvasDashscopeSyncImageTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  if (!payload) return false;
  if (payload.dashscopeJobKind === "multimodal-image-sync") return true;
  const kind = typeof payload.kind === "string" ? payload.kind : "";
  if (kind !== "image-engine" && kind !== "three-view-engine") return false;
  return (
    payload.providerKind === "DASHSCOPE" &&
    payload.syncGatewaySubmit === true &&
    typeof payload.gatewayLogId === "string" &&
    payload.gatewayLogId.trim().length > 0
  );
}

/** 画布异步视频引擎任务（可转入后台生成 / 延长 poll）。 */
export function isCanvasAsyncVideoEngineTaskPayload(
  payload: Record<string, unknown> | null | undefined,
): boolean {
  return (
    isCanvasVolcengineVideoTaskPayload(payload) ||
    isCanvasDashscopeVideoTaskPayload(payload) ||
    isCanvasBailianR2vVideoTaskPayload(payload) ||
    isCanvasMinimaxVideoTaskPayload(payload) ||
    isCanvasKieVideoTaskPayload(payload)
  );
}

/** SUBMITTED 任务超时阈值（毫秒）：火山 / DashScope / 百炼 R2V 视频用更长窗口。 */
export function resolveCanvasSubmittedTaskTimeoutMs(input: {
  inputPayload: unknown;
}): number {
  const payload =
    input.inputPayload && typeof input.inputPayload === "object"
      ? (input.inputPayload as Record<string, unknown>)
      : null;
  const min = isCanvasVolcengineVideoTaskPayload(payload)
    ? getCanvasVolcengineVideoTimeoutMin()
    : isCanvasDashscopeVideoTaskPayload(payload)
      ? getCanvasDashscopeVideoTimeoutMin()
      : isCanvasMinimaxVideoTaskPayload(payload)
        ? getCanvasMinimaxVideoTimeoutMin()
        : isCanvasBailianR2vVideoTaskPayload(payload)
          ? getCanvasBailianR2vVideoTimeoutMin()
          : isCanvasKieVideoTaskPayload(payload)
            ? getCanvasKieVideoTimeoutMin()
            : CANVAS_AI_TASK_TIMEOUT_MIN;
  return min * 60 * 1000;
}

export function resolveCanvasSubmittedTaskTimeoutMin(input: {
  inputPayload: unknown;
}): number {
  return Math.round(resolveCanvasSubmittedTaskTimeoutMs(input) / 60_000);
}

/** 单用户进行中 (PENDING + SUBMITTED) 任务上限 */
export function getCanvasUserInflightMax(): number {
  const raw = Number(process.env.CANVAS_AI_USER_INFLIGHT_MAX ?? "");
  return Number.isFinite(raw) && raw > 0 ? raw : 50;
}

/**
 * 单画布项目并发上限（前端运行队列 + 后端校验）。
 * 默认 5；env=0 表示不限制。
 */
export function getCanvasProjectInflightMax(): number {
  const raw = Number(process.env.CANVAS_PROJECT_INFLIGHT_MAX ?? "");
  if (Number.isFinite(raw)) {
    if (raw <= 0) return 0;
    return Math.round(raw);
  }
  return 5;
}

/** poll worker 每轮 SUBMITTED 上限 — 见 lib/generation/poll-config.ts */
export {
  getGenerationPollBatch,
  getGenerationPollBatch as getCanvasPollBatch,
} from "@/lib/generation/poll-config";

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
  kind: "image" | "text" | "video" | "audio",
  taskRef: string,
): string | null {
  const base = getCanvasAiPublicBase();
  const token = getCanvasAiKieCallbackToken();
  if (!base || !token) return null;
  const params = new URLSearchParams({ token, taskRef });
  return `${base}/api/canvas/kie/callback/${kind}?${params.toString()}`;
}

/** OSS key 命名 */
export type CanvasOssKind =
  | "node-image"
  | "node-video"
  | "node-audio"
  | "node-output"
  | "user-upload"
  | "style-library";

/** 平台内置风格库预览图（固定 key，便于增量覆盖上传） */
export function buildStyleLibraryOssKey(id: string, ext: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "webp";
  return `canvas/style-library/${safeId}.${safeExt}`;
}

/** 电商工具箱 · 平台模特库（固定 key，便于增量覆盖上传） */
export function buildEcomModelLibraryOssKey(id: string, ext: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "webp";
  return `ecom/model-library/${safeId}.${safeExt}`;
}

/** 电商工具箱 · 模板区案例图（固定 key，按 category 分子目录） */
export function buildEcomTemplateGalleryOssKey(
  category: string,
  id: string,
  ext: string,
): string {
  const safeCat = category.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "webp";
  return `ecom/template-gallery/${safeCat}/${safeId}.${safeExt}`;
}

/** 电商工具箱 · 模板区列表缩略图（sharp 预生成 WebP） */
export function buildEcomTemplateGalleryThumbOssKey(
  category: string,
  id: string,
): string {
  const safeCat = category.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `ecom/template-gallery/${safeCat}/${safeId}-thumb.webp`;
}

export type EcomTemplateGalleryUploadSlot =
  | "preview"
  | "cover"
  | "main"
  | "ref";

/** 管理后台分槽上传：preview=主媒体，cover/main/ref 互不覆盖 */
export function buildEcomTemplateGallerySlotOssKey(
  category: string,
  id: string,
  slot: EcomTemplateGalleryUploadSlot,
  ext: string,
  refKey?: string,
): string {
  if (slot === "preview") {
    return buildEcomTemplateGalleryOssKey(category, id, ext);
  }
  const safeCat = category.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "webp";
  if (slot === "ref") {
    const rk = (refKey ?? "0").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 24);
    return `ecom/template-gallery/${safeCat}/${safeId}-ref-${rk}.${safeExt}`;
  }
  return `ecom/template-gallery/${safeCat}/${safeId}-${slot}.${safeExt}`;
}

/** QuickReplica 内置模板预览图（固定 key） */
export function buildQuickReplicaBuiltinOssKey(id: string, ext: string): string {
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeExt = ext.replace(/^\./, "").toLowerCase() || "webp";
  return `quick-replica/builtin/${safeId}.${safeExt}`;
}

/** QuickReplica 内置场景 splat（固定 key，便于增量覆盖） */
export function buildQuickReplicaBuiltinSplatOssKey(templateId: string, tier: string): string {
  const safeId = templateId.replace(/[^a-zA-Z0-9_-]/g, "_");
  const safeTier = tier.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `quick-replica/builtin/splats/${safeId}-${safeTier}.spz`;
}

/** MiniMax 系统音色试听 MP3（固定 key） */
export function buildMinimaxVoicePreviewOssKey(voiceId: string): string {
  const safeId = voiceId.replace(/[^a-zA-Z0-9_().-]/g, "_");
  return `quick-replica/voices/${safeId}.mp3`;
}

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
    modelKey: "grok-imagine/text-to-image",
    displayName: "Grok Imagine · 文生图",
    vendor: "xai/grok",
    role: "IMAGE" as const,
    description: "xAI Grok Imagine · 文生图（KIE Gateway）。",
    sortOrder: 8,
    defaultParams: { aspect_ratio: "1:1" },
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
