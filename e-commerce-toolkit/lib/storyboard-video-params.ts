/** 故事版 · 百炼参考生视频（R2V）模型参数 */

import { pickBoundStoryboardModelKey } from "@/lib/storyboard-model-pick";
import type { StoryboardGatewayModel } from "@/lib/storyboard-types";

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
  const k = modelKey.trim();
  return k === "wan3.0-video" || k === "wan3.0-video-prime";
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

/** 弹层可调「生成配音/音效」的视频模型 */
export function videoModelSupportsGenerateAudio(modelKey: string): boolean {
  const k = modelKey.trim().toLowerCase();
  if (isStoryboardSeedanceKieVideoModel(k)) return true;
  if (/doubao-seedance/i.test(k)) return true;
  if (isStoryboardKling30KieVideoModel(k)) return true;
  if (/kling.*3\.0/i.test(k)) return true;
  if (/seedance-1\.5/i.test(k)) return true;
  return false;
}

export function videoResolutionOptionsForModel(
  modelKey: string,
): Array<{ value: string; label: string }> {
  const k = modelKey.trim().toLowerCase();
  if (isStoryboardWan30VideoModel(k) || isStoryboardBailianR2vModel(k)) {
    return [
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
    ];
  }
  if (isStoryboardKling30KieVideoModel(k) || isStoryboardSeedanceKieVideoModel(k)) {
    return [
      { value: "720p", label: "720p" },
      { value: "1080p", label: "1080p" },
      { value: "2k", label: "2K" },
    ];
  }
  return [
    { value: "720p", label: "720p" },
    { value: "1080p", label: "1080p" },
  ];
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

/** 整图成片 · 支持超过 15s 的模型（按推荐顺序） */
export const STORYBOARD_LONG_FULL_SHEET_VIDEO_MODEL_KEYS = [
  "wan3.0-video",
  "wan3.0-video-prime",
  "wan2.7-r2v",
] as const;

export type StoryboardSheetDurationSource = {
  totalDurationHintSec?: number;
  panels?: Array<{ durationHintSec?: number }>;
};

/** 从 sheet 解析建议总时长（优先 totalDurationHintSec，否则各镜 durationHintSec 之和） */
export function resolveSheetTotalDurationHintSec(
  sheet?: StoryboardSheetDurationSource | null,
): number | null {
  if (!sheet) return null;
  if (
    typeof sheet.totalDurationHintSec === "number" &&
    sheet.totalDurationHintSec > 0
  ) {
    return Math.round(sheet.totalDurationHintSec);
  }
  const panels = sheet.panels ?? [];
  if (panels.length === 0) return null;
  const sum = panels.reduce((acc, p) => {
    const hint = p.durationHintSec;
    return acc + (typeof hint === "number" && hint > 0 ? hint : 0);
  }, 0);
  return sum > 0 ? Math.round(sum) : null;
}

export function clampStoryboardFullSheetDurationSec(
  durationSec: number,
  modelKey: string,
): number {
  const range = resolveStoryboardVideoFullSheetDurationRange(modelKey);
  return Math.max(range.min, Math.min(range.max, Math.round(durationSec)));
}

export function storyboardFullSheetDurationMismatchMessage(
  modelKey: string,
  durationSec: number,
): string | null {
  const range = resolveStoryboardVideoFullSheetDurationRange(modelKey);
  const d = Math.round(durationSec);
  if (d > range.max) {
    if (
      d > 15 &&
      !isStoryboardWan30VideoModel(modelKey) &&
      !isStoryboardWan27BailianR2vModel(modelKey)
    ) {
      return `当前模型最长 ${range.max}s，成片需 ${d}s。请改选「万相 3.0」或「万相 2.7 R2V」。`;
    }
    return `当前模型最长 ${range.max}s，请缩短成片时长或更换模型。`;
  }
  if (d < range.min) {
    return `当前模型最短 ${range.min}s，请调长成片时长。`;
  }
  return null;
}

export function storyboardPanelDurationMismatchMessage(
  modelKey: string,
  durationSec: number,
): string | null {
  const range = resolveStoryboardVideoPanelDurationRange(modelKey);
  const d = Math.round(durationSec);
  if (d > range.max) {
    if (d > 15 && !isStoryboardWan30VideoModel(modelKey)) {
      return `单镜 ${d}s 超过当前模型上限 ${range.max}s，请改选万相 3.0。`;
    }
    return `单镜时长超过模型上限 ${range.max}s，请缩短或更换模型。`;
  }
  if (d < range.min) {
    return `单镜最短 ${range.min}s，请调长时长。`;
  }
  return null;
}

/**
 * 整图成片：按目标时长推荐视频模型（>15s 优先万相 3.0 / 2.7 R2V）。
 */
export function pickStoryboardVideoModelForFullSheetDuration(
  models: StoryboardGatewayModel[],
  durationSec: number,
  preferred: string,
): string {
  const d = Math.round(durationSec);
  const preferredRange = resolveStoryboardVideoFullSheetDurationRange(preferred);
  if (d >= preferredRange.min && d <= preferredRange.max) {
    return pickBoundStoryboardModelKey(models, preferred);
  }
  for (const key of STORYBOARD_LONG_FULL_SHEET_VIDEO_MODEL_KEYS) {
    const range = resolveStoryboardVideoFullSheetDurationRange(key);
    if (d >= range.min && d <= range.max && models.some((m) => m.modelKey === key)) {
      return pickBoundStoryboardModelKey(models, key);
    }
  }
  return pickBoundStoryboardModelKey(models, preferred);
}

/** 将 Gateway / 厂商视频错误转为用户可读说明（区分凭证 vs 余额） */
export function formatStoryboardVideoGenError(message: string): string {
  const text = message.trim();
  if (!text) return "镜头视频生成失败";
  const authLike =
    text.includes("UPSTREAM_AUTH_FAILED") ||
    text.includes("API key doesn't exist") ||
    text.includes("AuthenticationError") ||
    text.includes("凭证无效") ||
    text.includes("401") ||
    text.includes("403");
  if (authLike) {
    return "火山方舟 API Key 无效或不存在（不是余额/充值问题）。请在 Gateway 控制台 → 模型管理 → 火山凭证，检查 Seedance 所用 ark API Key 是否已正确配置并绑定到当前模型。";
  }
  const balanceLike =
    text.includes("UPSTREAM_INSUFFICIENT_BALANCE") ||
    text.includes("余额不足") ||
    text.includes("欠费") ||
    text.includes("Insufficient Balance");
  if (balanceLike) {
    return "厂商账户余额不足或欠费。请在火山引擎控制台为 Gateway 绑定的凭证充值后重试，或改用其它已绑定凭证/模型。";
  }
  return text;
}
