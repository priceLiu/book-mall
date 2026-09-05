export function isWan27BailianR2vModel(model: string): boolean {
  return model.trim() === "wan2.7-r2v";
}

export function isHappyhorseBailianR2vModel(model: string): boolean {
  const m = model.trim();
  return m === "happyhorse-1.0-r2v" || m === "happyhorse-1.1-r2v";
}

export function isWan26BailianR2vModel(model: string): boolean {
  const m = model.trim();
  return m === "wan2.6-r2v" || m === "wan2.6-r2v-flash";
}

/** 万相 2.6 multi-shot · reference_urls 上限 */
export const BAILIAN_R2V_WAN26_MAX_REFS = 5;

/** 万相 2.7 · media 上限（百炼 API 实测：max 5，非 9） */
export const BAILIAN_R2V_WAN27_MAX_REFS = 5;

/** HappyHorse · media 参考图上限（百炼文档 1～9） */
export const BAILIAN_R2V_HAPPYHORSE_MAX_REFS = 9;

export function bailianR2vMaxRefs(model: string): number {
  const m = model.trim();
  if (isWan26BailianR2vModel(m)) return BAILIAN_R2V_WAN26_MAX_REFS;
  if (isWan27BailianR2vModel(m)) return BAILIAN_R2V_WAN27_MAX_REFS;
  return BAILIAN_R2V_HAPPYHORSE_MAX_REFS;
}

/** 百炼 R2V 单条成片 API 时长上限（秒） */
export function bailianR2vMaxDurationSec(model: string): number {
  if (isWan26BailianR2vModel(model.trim())) return 10;
  return 30;
}

export function wan26R2vSizeFromAspect(
  aspectRatio: string,
  resolution: "720P" | "1080P",
): string {
  const r = aspectRatio.trim();
  if (r === "9:16" || r === "3:4") {
    return resolution === "1080P" ? "1080*1920" : "720*1280";
  }
  if (r === "1:1") {
    return resolution === "1080P" ? "1080*1080" : "720*720";
  }
  return resolution === "1080P" ? "1920*1080" : "1280*720";
}

export type BailianR2vRequestBody = {
  model: string;
  input: Record<string, unknown>;
  parameters: Record<string, unknown>;
};

function parseSeed(raw: string | undefined): number | undefined {
  if (raw == null) return undefined;
  const t = String(raw).trim();
  if (!t) return undefined;
  const n = Number(t);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return undefined;
  if (n < 0 || n > 2147483647) return undefined;
  return n;
}

export type BailianR2vMediaItem = {
  type: "first_frame" | "last_frame" | "reference_image";
  url: string;
};

/**
 * HappyHorse / 万相 2.7 R2V · media 类型映射。
 * 百炼 API 仅接受 type=reference_image（传 first_frame 会 422）。
 * 顺序仍约定：urls[0] 为分镜静帧/主图，其余 @ 资产为附加参考。
 */
export function buildBailianR2vMediaItems(
  model: string,
  urls: readonly string[],
): BailianR2vMediaItem[] {
  const max = bailianR2vMaxRefs(model);
  const slice = urls.map((s) => s.trim()).filter(Boolean).slice(0, max);
  if (!slice.length) return [];
  return slice.map((url) => ({ type: "reference_image" as const, url }));
}

/** Gateway inputSummary · 显式写入 mainFrameImageUrl，日志 UI 可单独展示分镜图 */
export function enrichBailianR2vInputForLog(
  built: BailianR2vRequestBody,
  referenceImageUrls: readonly string[],
): Record<string, unknown> {
  const media = Array.isArray(built.input.media)
    ? (built.input.media as BailianR2vMediaItem[])
    : [];
  const frameFromMedia =
    media.find((m) => m.type === "first_frame")?.url?.trim() ??
    media[0]?.url?.trim();
  const frameFromUrls = referenceImageUrls
    .map((u) => u.trim())
    .find((u) => u.length > 0 && /\/canvas\/node-image\//.test(u));
  const mainFrameImageUrl = frameFromMedia || frameFromUrls;
  return {
    ...built.input,
    parameters: built.parameters,
    referenceImageUrls: [...referenceImageUrls],
    ...(mainFrameImageUrl ? { mainFrameImageUrl } : {}),
  };
}

/** 百炼 R2V：wan2.6 用 reference_urls；wan2.7 / happyhorse 用 media */
export function buildBailianR2vRequestBody(opts: {
  model: string;
  prompt: string;
  referenceImageUrls: string[];
  resolution: "720P" | "1080P";
  ratio: string;
  duration: number;
  seedStr?: string;
  parameterExtras?: Record<string, unknown>;
}): BailianR2vRequestBody {
  const model = opts.model.trim();
  const urls = opts.referenceImageUrls.map((s) => s.trim()).filter(Boolean);
  const duration = Math.min(
    bailianR2vMaxDurationSec(model),
    Math.max(3, Math.floor(opts.duration)),
  );
  const seed = parseSeed(opts.seedStr);
  const ratio = opts.ratio.trim() || "16:9";

  if (isWan26BailianR2vModel(model)) {
    const parameters: Record<string, unknown> = {
      ...(opts.parameterExtras ?? {}),
      size: wan26R2vSizeFromAspect(ratio, opts.resolution),
      duration: Math.min(10, duration),
      shot_type: "multi",
      audio: true,
      watermark: false,
    };
    if (seed != null) parameters.seed = seed;
    return {
      model,
      input: {
        prompt: opts.prompt.trim(),
        reference_urls: urls.slice(0, BAILIAN_R2V_WAN26_MAX_REFS),
      },
      parameters,
    };
  }

  const parameters: Record<string, unknown> = {
    ...(opts.parameterExtras ?? {}),
    resolution: opts.resolution,
    ratio,
    duration,
    watermark: false,
  };
  if (seed != null) parameters.seed = seed;

  if (isWan27BailianR2vModel(model)) {
    return {
      model,
      input: {
        prompt: opts.prompt.trim(),
        media: buildBailianR2vMediaItems(model, urls),
      },
      parameters,
    };
  }

  return {
    model,
    input: {
      prompt: opts.prompt.trim(),
      media: buildBailianR2vMediaItems(model, urls),
    },
    parameters,
  };
}
