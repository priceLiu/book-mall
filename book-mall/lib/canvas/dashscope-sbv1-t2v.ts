/**
 * 分镜视频 1.0 · DashScope 原生文生视频（wan / HappyHorse）
 */

export const DASHSCOPE_SBV1_WAN_T2V_MODEL_KEYS = [
  "wan2.6-t2v",
  "wan2.7-t2v",
  "wan2.7-t2v-2026-04-25",
] as const;

export const DASHSCOPE_HAPPYHORSE_T2V_MODEL_KEYS = [
  "happyhorse-1.0-t2v",
  "happyhorse-1.1-t2v",
] as const;

export const DASHSCOPE_HAPPYHORSE_I2V_MODEL_KEYS = [
  "happyhorse-1.0-i2v",
  "happyhorse-1.1-i2v",
] as const;

export const DASHSCOPE_SBV1_T2V_MODEL_KEYS = [
  ...DASHSCOPE_SBV1_WAN_T2V_MODEL_KEYS,
  ...DASHSCOPE_HAPPYHORSE_T2V_MODEL_KEYS,
] as const;

export type DashscopeSbv1T2vModelKey =
  (typeof DASHSCOPE_SBV1_T2V_MODEL_KEYS)[number];

export function isDashscopeHappyhorseTextToVideoModel(modelKey: string): boolean {
  return (DASHSCOPE_HAPPYHORSE_T2V_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

export function isDashscopeHappyhorseImageToVideoModel(modelKey: string): boolean {
  return (DASHSCOPE_HAPPYHORSE_I2V_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

export function isDashscopeSbv1TextToVideoModel(modelKey: string): boolean {
  return (DASHSCOPE_SBV1_T2V_MODEL_KEYS as readonly string[]).includes(
    modelKey.trim(),
  );
}

const T2V_ASPECT_TO_SIZE: Record<string, readonly [string, string]> = {
  "16:9": ["1280*720", "1920*1080"],
  "9:16": ["720*1280", "1080*1920"],
  "1:1": ["720*720", "1080*1080"],
  "4:3": ["960*720", "1440*1080"],
  "3:4": ["720*960", "1080*1440"],
};

function t2vAspectRatioToSize(
  aspect: string,
  resolution: "720P" | "1080P",
): string {
  const pair = T2V_ASPECT_TO_SIZE[aspect.trim()] ?? T2V_ASPECT_TO_SIZE["16:9"]!;
  return resolution === "1080P" ? pair[1] : pair[0];
}

function parseResolution(raw: string): "720P" | "1080P" {
  return /^720/i.test(raw.trim()) ? "720P" : "1080P";
}

export function buildDashscopeHappyhorseT2vVideoBody(opts: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  seed?: number;
  watermark?: boolean;
}): { input: { prompt: string }; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const duration = Math.min(15, Math.max(3, Math.floor(opts.durationSec)));
  const parameters: Record<string, unknown> = {
    resolution: parseResolution(opts.resolution),
    ratio: opts.aspectRatio.trim() || "16:9",
    duration,
    watermark: opts.watermark === true,
  };
  if (opts.seed != null && Number.isInteger(opts.seed)) {
    parameters.seed = opts.seed;
  }
  return {
    input: { prompt },
    parameters,
  };
}

export function buildDashscopeHappyhorseI2vVideoBody(opts: {
  prompt: string;
  firstFrameUrl: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  seed?: number;
  watermark?: boolean;
}): { input: Record<string, unknown>; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for image-to-video");
  const first = opts.firstFrameUrl.trim();
  if (!first) throw new Error("first frame image required for image-to-video");
  const duration = Math.min(15, Math.max(3, Math.floor(opts.durationSec)));
  const parameters: Record<string, unknown> = {
    resolution: parseResolution(opts.resolution),
    ratio: opts.aspectRatio.trim() || "16:9",
    duration,
    watermark: opts.watermark === true,
  };
  if (opts.seed != null && Number.isInteger(opts.seed)) {
    parameters.seed = opts.seed;
  }
  return {
    input: {
      prompt,
      media: [{ type: "first_frame", url: first }],
    },
    parameters,
  };
}

export function buildDashscopeSbv1T2vVideoBody(opts: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  promptExtend?: boolean;
  modelKey?: string;
  seed?: number;
  watermark?: boolean;
}): { input: Record<string, unknown>; parameters: Record<string, unknown> } {
  const modelKey = opts.modelKey?.trim() ?? "";
  if (isDashscopeHappyhorseTextToVideoModel(modelKey)) {
    return buildDashscopeHappyhorseT2vVideoBody(opts);
  }

  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const res = parseResolution(opts.resolution);
  const dur: 5 | 10 = opts.durationSec <= 7 ? 5 : 10;
  return {
    input: { prompt },
    parameters: {
      size: t2vAspectRatioToSize(opts.aspectRatio, res),
      duration: dur,
      prompt_extend: opts.promptExtend !== false,
    },
  };
}
