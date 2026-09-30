export function formatClipTimeSec(sec: number): string {
  const s = Math.max(0, sec);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  if (m <= 0) return `${r.toFixed(2)}s`;
  return `${m}:${r.toFixed(2).padStart(5, "0")}`;
}
