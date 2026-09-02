/**
 * 全站 · 后台生成 Dock 策略（Canvas / 电商工具箱 / Gateway 共用口径）
 * 规范：docs/generation-background-dock.md
 */

/** 前台全屏/内联 busy 最长展示（超时后缩至右下角 Dock） */
export const BACKGROUND_DOCK_FOREGROUND_MS = 3 * 60 * 1000;

/** 持续后台生成文案切换阈值（与 Gateway VIDEO_BACKGROUND_UI_MS 对齐） */
export const BACKGROUND_DOCK_PERSISTENT_MS = 15 * 60 * 1000;

/** Dock 内轮询间隔 */
export const BACKGROUND_DOCK_POLL_MS = 15_000;

/** 前台轮询间隔（电商故事版整图成片） */
export const BACKGROUND_DOCK_FOREGROUND_POLL_MS = 4_000;

/** 运行中任务在 Dock 露出的最小时长（此前完全隐藏） */
export const BACKGROUND_DOCK_LONG_TASK_MS = 10 * 60 * 1000;

/** 成功完成后面板展示时长，随后自动收起并清除 */
export const BACKGROUND_DOCK_SUCCESS_FLASH_MS = 2_000;

/** 收起/消失过渡时长（与 Dock CSS transition 一致） */
export const BACKGROUND_DOCK_EXIT_ANIM_MS = 320;

export const BACKGROUND_DOCK_LABEL_RUNNING = "生成中…";
export const BACKGROUND_DOCK_LABEL_PERSISTENT = "持续后台生成中…";
export const BACKGROUND_DOCK_LABEL_SUCCEEDED = "已完成";
export const BACKGROUND_DOCK_LABEL_FAILED = "生成失败";

export function formatBackgroundGenerationAge(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

export function resolveBackgroundGenerationLabel(
  startedAtMs: number,
  nowMs: number = Date.now(),
): string {
  const age = nowMs - startedAtMs;
  if (age >= BACKGROUND_DOCK_PERSISTENT_MS) return BACKGROUND_DOCK_LABEL_PERSISTENT;
  return BACKGROUND_DOCK_LABEL_RUNNING;
}

/** 伪进度：按预期时长平滑逼近 95%，避免假 100% */
export function estimateBackgroundGenerationProgress(
  startedAtMs: number,
  expectedDurationMs: number,
  nowMs: number = Date.now(),
): number {
  if (expectedDurationMs <= 0) return 0;
  const ratio = (nowMs - startedAtMs) / expectedDurationMs;
  return Math.min(0.95, Math.max(0.04, ratio));
}
