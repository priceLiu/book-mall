/** 画布自动保存间隔（用户偏好 · localStorage） */

export const CANVAS_AUTOSAVE_DEBOUNCE_MS = 1500;

/** 与 book-mall `CANVAS_PROJECT_HISTORY_MAX` 一致 · 每项目历史版本环形缓冲上限 */
export const CANVAS_PROJECT_HISTORY_MAX = 20;

export type CanvasAutosaveIntervalOption = {
  id: string;
  label: string;
  ms: number;
};

export const CANVAS_AUTOSAVE_INTERVAL_OPTIONS: CanvasAutosaveIntervalOption[] =
  [
    { id: "5m", label: "5 分钟", ms: 300_000 },
    { id: "15m", label: "15 分钟", ms: 900_000 },
    { id: "30m", label: "30 分钟", ms: 1_800_000 },
    { id: "off", label: "关闭自动保存", ms: 0 },
  ];

const STORAGE_KEY = "canvas-autosave-interval-ms";
const DEFAULT_MS = 300_000;

export function getCanvasAutosaveIntervalMs(): number {
  if (typeof window === "undefined") return DEFAULT_MS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_MS;
    const n = Number.parseInt(raw, 10);
    if (!Number.isFinite(n)) return DEFAULT_MS;
    if (CANVAS_AUTOSAVE_INTERVAL_OPTIONS.some((o) => o.ms === n)) return n;
    return DEFAULT_MS;
  } catch {
    return DEFAULT_MS;
  }
}

export function setCanvasAutosaveIntervalMs(ms: number): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, String(ms));
    window.dispatchEvent(new CustomEvent("canvas:autosave-interval-changed"));
  } catch {
    // ignore
  }
}

export function formatCanvasAutosaveIntervalLabel(ms: number): string {
  const hit = CANVAS_AUTOSAVE_INTERVAL_OPTIONS.find((o) => o.ms === ms);
  if (hit) return hit.label;
  if (ms <= 0) return "关闭自动保存";
  if (ms % 60_000 === 0) return `${ms / 60_000} 分钟`;
  return `${Math.round(ms / 1000)} 秒`;
}
