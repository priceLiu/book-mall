/** 画布自动保存间隔（用户偏好 · localStorage） */

export const CANVAS_AUTOSAVE_DEBOUNCE_MS = 1500;

export type CanvasAutosaveIntervalOption = {
  id: string;
  label: string;
  ms: number;
};

export const CANVAS_AUTOSAVE_INTERVAL_OPTIONS: CanvasAutosaveIntervalOption[] =
  [
    { id: "30s", label: "30 秒", ms: 30_000 },
    { id: "1m", label: "1 分钟", ms: 60_000 },
    { id: "2m", label: "2 分钟", ms: 120_000 },
    { id: "5m", label: "5 分钟", ms: 300_000 },
    { id: "10m", label: "10 分钟", ms: 600_000 },
    { id: "off", label: "关闭自动保存", ms: 0 },
  ];

const STORAGE_KEY = "canvas-autosave-interval-ms";
const DEFAULT_MS = 60_000;

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
  return hit?.label ?? `${Math.round(ms / 1000)} 秒`;
}
