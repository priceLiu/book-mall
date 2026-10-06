/** Dock · `/镜头描述` 或 `/镜头描述<filter>` 触发镜头库 popover */
export function scanSlashCameraShotTriggerBeforeCursor(
  textBeforeCursor: string,
): { at: number; filter: string } | null {
  const marker = "/镜头描述";
  const idx = textBeforeCursor.lastIndexOf(marker);
  if (idx < 0) return null;
  const between = textBeforeCursor.slice(0, idx);
  if (between.length > 0 && !/\s$/.test(between)) return null;
  const after = textBeforeCursor.slice(idx + marker.length);
  if (/\s/.test(after)) return null;
  return { at: idx, filter: after };
}
