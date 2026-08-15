/** 故事版 · 百炼参考生视频（R2V）模型参数 */

export const STORYBOARD_BAILIAN_R2V_MODELS = [
  "happyhorse-1.0-r2v",
  "happyhorse-1.1-r2v",
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

export function isStoryboardWan26BailianR2vModel(modelKey: string): boolean {
  const k = modelKey.trim();
  return k === "wan2.6-r2v" || k === "wan2.6-r2v-flash";
}

/** HappyHorse 百炼 R2V · media 1～9 张（与 book-mall bailianR2vMaxRefs 一致） */
export function isStoryboardHappyhorseBailianR2vModel(modelKey: string): boolean {
  const k = modelKey.trim();
  return k === "happyhorse-1.0-r2v" || k === "happyhorse-1.1-r2v";
}

/** 百炼 R2V · 参考图 media 上限（展示用，与 book-mall 调入规则一致） */
export function resolveStoryboardBailianR2vMaxRefImages(modelKey: string): number | null {
  const k = modelKey.trim();
  if (isStoryboardWan26BailianR2vModel(k)) return 5;
  if (k === "wan2.7-r2v") return 5;
  if (isStoryboardHappyhorseBailianR2vModel(k) || isStoryboardBailianR2vModel(k)) return 9;
  return null;
}

export function isStoryboardWan30VideoModel(modelKey: string): boolean {
  return modelKey.trim() === "wan3.0-video";
}

export type StoryboardVideoDurationRange = {
  min: number;
  max: number;
  label: string;
};

function storyboardDurationRangeLabel(min: number, max: number): string {
  return min === max ? `${min}s` : `${min}–${max}s`;
}

export function isStoryboardWan27BailianR2vModel(modelKey: string): boolean {
  return modelKey.trim() === "wan2.7-r2v";
}

/** 百炼 R2V · 单条 API 时长上限（与 bailian-r2v-body / Gateway schema 一致） */
export function resolveStoryboardBailianR2vMaxDurationSec(modelKey: string): number {
  const k = modelKey.trim();
  if (isStoryboardWan26BailianR2vModel(k)) return 10;
  if (isStoryboardWan27BailianR2vModel(k)) return 30;
  if (isStoryboardHappyhorseBailianR2vModel(k)) return 15;
  if (isStoryboardBailianR2vModel(k)) return 15;
  return 15;
}

/** 整图成片 / 方案① direct · 时长滑块范围 */
export function resolveStoryboardVideoFullSheetDurationRange(
  modelKey: string,
): StoryboardVideoDurationRange {
  const k = modelKey.trim();
  if (isStoryboardWan26BailianR2vModel(k)) {
    return { min: 3, max: 10, label: "3–10s" };
  }
  if (isStoryboardWan27BailianR2vModel(k)) {
    return { min: 3, max: 30, label: "3–30s" };
  }
  if (isStoryboardHappyhorseBailianR2vModel(k) || isStoryboardBailianR2vModel(k)) {
    return { min: 3, max: 15, label: "3–15s" };
  }
  if (isStoryboardWan30VideoModel(k)) {
    return { min: 3, max: 30, label: "3–30s" };
  }
  if (isStoryboardKling30KieVideoModel(k)) {
    return { min: 4, max: 15, label: "4–15s" };
  }
  if (isStoryboardSeedanceKieVideoModel(k)) {
    return { min: 5, max: 15, label: "5–15s" };
  }
  if (/doubao-seedance|seedance-1\.5/i.test(k)) {
    return { min: 5, max: 10, label: "5–10s" };
  }
  if (/happyhorse.*-(t2v|i2v)/i.test(k)) {
    return { min: 3, max: 15, label: "3–15s" };
  }
  if (/wan2\.[67]-t2v/i.test(k)) {
    return { min: 5, max: 10, label: "5/10s" };
  }
  return { min: 5, max: 10, label: "5–10s" };
}

/** 单镜头成片 · 时长滑块范围 */
export function resolveStoryboardVideoPanelDurationRange(
  modelKey: string,
): StoryboardVideoDurationRange {
  const k = modelKey.trim();
  if (isStoryboardBailianR2vModel(k)) {
    const max = Math.min(15, resolveStoryboardBailianR2vMaxDurationSec(k));
    return { min: 3, max, label: storyboardDurationRangeLabel(3, max) };
  }
  if (isStoryboardKling30KieVideoModel(k)) {
    return { min: 4, max: 15, label: "4–15s" };
  }
  if (isStoryboardWan30VideoModel(k)) {
    return { min: 3, max: 30, label: "3–30s" };
  }
  if (isStoryboardSeedanceKieVideoModel(k)) {
    return { min: 5, max: 15, label: "5–15s" };
  }
  if (/doubao-seedance|seedance|bytedance\/seedance/i.test(k)) {
    return { min: 5, max: 10, label: "5–10s" };
  }
  if (/happyhorse.*-(t2v|i2v)/i.test(k)) {
    return { min: 3, max: 15, label: "3–15s" };
  }
  return { min: 2, max: 8, label: "2–8s" };
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
