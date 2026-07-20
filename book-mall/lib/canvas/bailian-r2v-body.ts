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
  const duration = Math.min(15, Math.max(3, Math.floor(opts.duration)));
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
        media: urls.slice(0, BAILIAN_R2V_WAN27_MAX_REFS).map((url) => ({
          type: "reference_image",
          url,
        })),
      },
      parameters,
    };
  }

  return {
    model,
    input: {
      prompt: opts.prompt.trim(),
      media: urls.slice(0, BAILIAN_R2V_HAPPYHORSE_MAX_REFS).map((url) => ({
        type: "reference_image",
        url,
      })),
    },
    parameters,
  };
}
