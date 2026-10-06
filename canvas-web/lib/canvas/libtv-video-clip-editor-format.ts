/** 用元素屏幕矩形换算时间（含 Dock 的 scale / zoom，不用 scrollWidth） */
export function clipSecFromTrackClientX(
  clientX: number,
  rectLeft: number,
  rectWidth: number,
  durationSec: number,
): number {
  if (rectWidth <= 0 || durationSec <= 0) return 0;
  const ratio = Math.min(1, Math.max(0, (clientX - rectLeft) / rectWidth));
  return ratio * durationSec;
}

/** 入出点仍几乎覆盖整段时，生成结果会和原片一样长 */
export function isClipRangeStillFullLength(
  startSec: number,
  endSec: number,
  durationSec: number,
): boolean {
  if (!(durationSec > 0.8)) return false;
  return endSec - startSec >= durationSec - 0.35;
}

export function formatClipTimeSec(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  if (m <= 0) return `${r.toFixed(2)}s`;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
}
