/** 与画布一致：整数不带小数，否则最多 2 位。 */
export function formatCreditsDisplay(credits: number): string {
  const n = Number(credits);
  if (!Number.isFinite(n)) return "0";
  const clamped = Math.max(0, n);
  if (Math.abs(clamped - Math.round(clamped)) < 1e-9) {
    return Math.round(clamped).toLocaleString("zh-CN");
  }
  return clamped.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}
