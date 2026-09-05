import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

/** 存于 engine.params · 勾选后音色行试听走实时合成并扣积分 */
export const LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY = "tts_param_preview_billing";

export type LibtvTtsPreviewContext = {
  modelKey: string;
  params: Record<string, unknown>;
  projectId?: string;
  /** 音色行 · 按各行 voiceId + Dock 参数实时合成（勾选调参试听后为 true） */
  rowParamPreview?: boolean;
  /** 本次试听经 Gateway 记 log 并结算积分 */
  billable?: boolean;
};

/** 音色列表 · 勾选调参试听后的行内合成规格（与 previewContext 解耦，避免 OSS 回退） */
export type LibtvTtsRowPreviewSpec = {
  modelKey: string;
  projectId?: string;
  dockParams: Record<string, unknown>;
};

/** 由 Popover 传入 · 为音色行构建实时合成 context */
export function buildLibtvTtsRowPreviewContextFromSpec(
  spec: LibtvTtsRowPreviewSpec,
): LibtvTtsPreviewContext {
  return {
    modelKey: spec.modelKey.trim(),
    ...(spec.projectId?.trim() ? { projectId: spec.projectId.trim() } : {}),
    params: stripLibtvTtsRowVoiceParams(spec.dockParams),
    rowParamPreview: true,
    billable: true,
  };
}

export function isLibtvTtsParamPreviewBillingEnabled(
  params: Record<string, unknown>,
): boolean {
  return params[LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY] === true;
}

export function isLibtvTtsRowPreviewActive(args: {
  billingPreviewEnabled?: boolean;
  params?: Record<string, unknown>;
}): boolean {
  if (args.billingPreviewEnabled === true) return true;
  return isLibtvTtsParamPreviewBillingEnabled(args.params ?? {});
}

function readTtsParamNumber(raw: unknown): number | undefined {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** 试听 / 生成共用的 TTS 参数字段（与 book-mall canvas-tts-run-params 对齐） */
export const LIBTV_TTS_PREVIEW_PARAM_KEYS = [
  "speed",
  "vol",
  "pitch",
  "emotion",
  "language_type",
  "instruction",
  "voice_speed",
  "voice_volume",
  "voice_pitch",
  "volume",
] as const;

/** 音色行试听 · 仅传语气/语速等，禁止携带 Dock 已选 voice_id */
export function stripLibtvTtsRowVoiceParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...params };
  delete out.voice_id;
  delete out.voice;
  delete out.voice_label;
  delete out[LIBTV_TTS_PARAM_PREVIEW_BILLING_KEY];
  return out;
}

export function pickLibtvTtsPreviewParams(
  params: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const rowParams = stripLibtvTtsRowVoiceParams(params);
  for (const key of LIBTV_TTS_PREVIEW_PARAM_KEYS) {
    const raw = rowParams[key];
    if (raw === undefined || raw === null || raw === "") continue;
    out[key] = raw;
  }
  return out;
}

/** Dock 参数相对默认值有改动（须走实时合成，且与 OSS 原样音文案一致） */
export function hasAdjustedLibtvTtsParams(
  params: Record<string, unknown>,
): boolean {
  if (String(params.emotion ?? "").trim()) return true;
  if (String(params.instruction ?? "").trim()) return true;
  const speed = readTtsParamNumber(params.speed);
  if (speed != null && Math.abs(speed - 1) > 0.001) return true;
  const vol = readTtsParamNumber(params.vol);
  if (vol != null && Math.abs(vol - 1) > 0.001) return true;
  const pitch = readTtsParamNumber(params.pitch);
  if (pitch != null && pitch !== 0) return true;
  return false;
}

/**
 * 音色行试听路由：
 * - MiniMax 未勾选 → 各行 OSS 原样音（音色各不相同）
 * - MiniMax 勾选「调参试听」→ 各行 voiceId + 当前 Dock 参数实时合成
 * - Qwen 无 OSS：默认合成；调参后须勾选
 */
export function shouldUseLibtvDynamicTtsPreview(
  context?: LibtvTtsPreviewContext,
  voiceId?: string,
  options?: { minimaxOssFallback?: boolean },
): boolean {
  if (!context?.modelKey?.trim() || !voiceId?.trim()) return false;
  if (context.rowParamPreview === true) return true;

  const params = context.params ?? {};
  const adjusted = hasAdjustedLibtvTtsParams(params);
  const billing = isLibtvTtsParamPreviewBillingEnabled(params);

  if (options?.minimaxOssFallback === false) {
    if (adjusted) return billing;
    return true;
  }

  if (billing) return true;
  return false;
}

/** 统一「音色与参数」弹层 · 传给音色行的 previewContext（不含 Dock 已选 voice） */
export function buildLibtvTtsVoiceRowPreviewContext(
  previewContext: LibtvTtsPreviewContext | undefined,
  params: Record<string, unknown>,
  options?: { minimaxOssFallback?: boolean; billingEnabled?: boolean },
): LibtvTtsPreviewContext | undefined {
  if (!previewContext) return undefined;

  const billing =
    options?.billingEnabled ?? isLibtvTtsParamPreviewBillingEnabled(params);
  const adjusted = hasAdjustedLibtvTtsParams(params);
  const minimaxOss = options?.minimaxOssFallback !== false;
  const rowParams = stripLibtvTtsRowVoiceParams(params);

  if (minimaxOss) {
    if (!billing) return undefined;
    return {
      ...previewContext,
      params: rowParams,
      rowParamPreview: true,
      billable: true,
    };
  }

  if (adjusted && !billing) return undefined;
  return {
    ...previewContext,
    params: rowParams,
    rowParamPreview: billing || !adjusted,
    billable: billing,
  };
}

const previewCache = new Map<string, string>();

function stableParams(params: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(params).sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function buildLibtvTtsPreviewCacheKey(args: {
  modelKey: string;
  voiceId: string;
  params: Record<string, unknown>;
  text?: string;
}): string {
  return JSON.stringify({
    modelKey: args.modelKey.trim(),
    voiceId: args.voiceId.trim(),
    params: stableParams(args.params),
    text: args.text?.trim() ?? "",
  });
}

export async function fetchLibtvTtsPreviewDataUrl(args: {
  base: string;
  modelKey: string;
  voiceId: string;
  params: Record<string, unknown>;
  projectId?: string;
  text?: string;
  signal?: AbortSignal;
  skipCache?: boolean;
  billable?: boolean;
}): Promise<{ dataUrl: string; creditsCharged?: number }> {
  const previewParams = pickLibtvTtsPreviewParams(args.params);
  const cacheKey = buildLibtvTtsPreviewCacheKey({
    ...args,
    params: previewParams,
  });
  if (!args.skipCache) {
    const cached = previewCache.get(cacheKey);
    if (cached) return { dataUrl: cached };
  }

  const { url, init } = resolveBookMallBrowserRequest(
    args.base,
    "/api/canvas/tts/preview",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        modelKey: args.modelKey,
        voiceId: args.voiceId,
        params: previewParams,
        projectId: args.projectId,
        text: args.text,
        billable: args.billable === true,
      }),
      signal: args.signal,
    },
  );
  const res = await fetch(url, {
    ...init,
    credentials: init.credentials ?? "include",
  });
  const data = (await res.json().catch(() => ({}))) as {
    dataUrl?: string;
    creditsCharged?: number;
    message?: string;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.message ?? data.error ?? `试听失败（${res.status}）`);
  }
  const dataUrl = data.dataUrl?.trim();
  if (!dataUrl) throw new Error("invalid tts preview response");
  if (!args.skipCache) previewCache.set(cacheKey, dataUrl);
  return {
    dataUrl,
    creditsCharged:
      typeof data.creditsCharged === "number" ? data.creditsCharged : undefined,
  };
}
