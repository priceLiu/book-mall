/** 点数 -> 展示用人民币（元，两位小数）；1 点 = ¥0.01 */
export function formatPointsAsYuan(points: number): string {
  return (points / 100).toFixed(2);
}

/** 管理后台等：点数千分位整数展示 */
export function formatPointsIntegerCn(points: number): string {
  return points.toLocaleString("zh-CN");
}
