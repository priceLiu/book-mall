/** 故事版 · 百炼参考生视频（R2V）模型参数 */

export const STORYBOARD_BAILIAN_R2V_MODELS = [
  "happyhorse-1.0-r2v",
  "wan2.7-r2v",
  "wan2.6-r2v",
  "wan2.6-r2v-flash",
] as const;

export type StoryboardBailianR2vModel =
  (typeof STORYBOARD_BAILIAN_R2V_MODELS)[number];

export const STORYBOARD_R2V_RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 竖屏" },
  { value: "16:9", label: "16:9 横屏" },
  { value: "3:4", label: "3:4" },
  { value: "4:3", label: "4:3" },
  { value: "4:5", label: "4:5" },
  { value: "5:4", label: "5:4" },
  { value: "1:1", label: "1:1" },
] as const;

export type StoryboardR2vRatio =
  (typeof STORYBOARD_R2V_RATIO_OPTIONS)[number]["value"];

export function isStoryboardBailianR2vModel(modelKey: string): boolean {
  return (STORYBOARD_BAILIAN_R2V_MODELS as readonly string[]).includes(
    modelKey.trim(),
  );
}

export function isStoryboardWanR2vModel(modelKey: string): boolean {
  const k = modelKey.trim();
  return k === "wan2.7-r2v" || k === "wan2.6-r2v" || k === "wan2.6-r2v-flash";
}

export function isStoryboardKling30KieVideoModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "kling-3.0/video" || k === "kling-3.0";
}

export type StoryboardVideoAspectRatio = "16:9" | "9:16" | "1:1";

export function isStoryboardSeedanceKieVideoModel(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  return k === "bytedance/seedance-2" || k.includes("bytedance/seedance");
}

export function aspectRatioFromR2vRatio(
  ratio: string,
): "16:9" | "9:16" | undefined {
  if (ratio === "16:9" || ratio === "9:16") return ratio;
  return undefined;
}

export function bailianResolutionFromStoryboard(
  resolution: "720p" | "1080p",
): "720P" | "1080P" {
  return resolution === "720p" ? "720P" : "1080P";
}
