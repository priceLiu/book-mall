/**
 * 分镜视频 1.0 · DashScope 原生文生视频（wan2.6-t2v / wan2.7-t2v）
 */

export const DASHSCOPE_SBV1_T2V_MODEL_KEYS = [
  "wan2.6-t2v",
  "wan2.7-t2v",
  "wan2.7-t2v-2026-04-25",
] as const;

export type DashscopeSbv1T2vModelKey =
  (typeof DASHSCOPE_SBV1_T2V_MODEL_KEYS)[number];

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

export function buildDashscopeSbv1T2vVideoBody(opts: {
  prompt: string;
  aspectRatio: string;
  resolution: string;
  durationSec: number;
  promptExtend?: boolean;
}): { input: { prompt: string }; parameters: Record<string, unknown> } {
  const prompt = opts.prompt.trim();
  if (!prompt) throw new Error("prompt required for text-to-video");
  const res: "720P" | "1080P" = /^720/i.test(opts.resolution.trim())
    ? "720P"
    : "1080P";
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
