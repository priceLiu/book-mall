/** 未命名画布时的默认名称：带日期时间，便于唯一识别 */
export function defaultCanvasProjectName(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const mo = pad(now.getMonth() + 1);
  const d = pad(now.getDate());
  const h = pad(now.getHours());
  const mi = pad(now.getMinutes());
  const s = pad(now.getSeconds());
  return `画布 ${y}${mo}${d}-${h}${mi}${s}`;
}
