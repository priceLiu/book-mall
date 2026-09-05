/**
 * 与 book-mall/lib/generation/background-generation-dock-policy.ts 保持同步
 * 规范：docs/generation-background-dock.md
 */
export const BACKGROUND_DOCK_FOREGROUND_MS = 3 * 60 * 1000;
export const BACKGROUND_DOCK_PERSISTENT_MS = 15 * 60 * 1000;
export const BACKGROUND_DOCK_POLL_MS = 15_000;
export const BACKGROUND_DOCK_FOREGROUND_POLL_MS = 4_000;

/** 运行中任务在 Dock 露出的最小时长（此前完全隐藏） */
export const BACKGROUND_DOCK_LONG_TASK_MS = 10 * 60 * 1000;

/** 成功完成后面板展示时长，随后自动收起并清除 */
export const BACKGROUND_DOCK_SUCCESS_FLASH_MS = 2_000;

/** 收起/消失过渡时长（与 Dock CSS transition 一致） */
export const BACKGROUND_DOCK_EXIT_ANIM_MS = 320;

export function isBackgroundDockTaskVisible(
  task: { status: "running" | "succeeded" | "failed"; startedAt: string },
  nowMs: number = Date.now(),
): boolean {
  if (task.status === "succeeded" || task.status === "failed") return true;
  if (task.status === "running") {
    const started = new Date(task.startedAt).getTime();
    if (Number.isNaN(started)) return false;
    return nowMs - started >= BACKGROUND_DOCK_LONG_TASK_MS;
  }
  return false;
}

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

export function estimateBackgroundGenerationProgress(
  startedAtMs: number,
  expectedDurationMs: number,
  nowMs: number = Date.now(),
): number {
  if (expectedDurationMs <= 0) return 0;
  const ratio = (nowMs - startedAtMs) / expectedDurationMs;
  return Math.min(0.95, Math.max(0.04, ratio));
}

/** 整图成片默认可预期时长（wan3 / seedance 等） */
export const STORYBOARD_FULL_VIDEO_EXPECTED_MS = 10 * 60 * 1000;
/** 单镜视频默认可预期时长 */
export const STORYBOARD_PANEL_VIDEO_EXPECTED_MS = 6 * 60 * 1000;
