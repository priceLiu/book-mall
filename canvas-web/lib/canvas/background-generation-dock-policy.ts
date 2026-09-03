/**
 * 与 book-mall/lib/generation/background-generation-dock-policy.ts 保持同步
 * 规范：docs/generation-background-dock.md
 */
export const BACKGROUND_DOCK_FOREGROUND_MS = 3 * 60 * 1000;
export const BACKGROUND_DOCK_PERSISTENT_MS = 15 * 60 * 1000;
export const BACKGROUND_DOCK_LONG_TASK_MS = 10 * 60 * 1000;
export const BACKGROUND_DOCK_SUCCESS_FLASH_MS = 2_000;
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
