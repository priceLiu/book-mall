/**
 * 工具站前台统一展示：点为主，人民币为辅（100 点 = 1 元）。
 */

export function formatPointsPrimaryYuanSecondary(points: number): string {
  const p = Math.max(0, Math.floor(points));
  return `${p.toLocaleString("zh-CN")} 点（¥${(p / 100).toFixed(2)}）`;
}

/** 余额不足等：提示还差多少点 */
export function formatRequiredPointsShortfall(requiredPoints: unknown): string {
  if (
    typeof requiredPoints !== "number" ||
    !Number.isFinite(requiredPoints) ||
    requiredPoints <= 0
  ) {
    return "请充值";
  }
  const p = Math.max(0, Math.floor(requiredPoints));
  return `需 ${p.toLocaleString("zh-CN")} 点（¥${(p / 100).toFixed(2)}）`;
}

/**
 * 从 402 响应读取 requiredPoints，兼容旧字段 requiredMinor。
 */
export function readRequiredPointsFromSettleJson(
  json: Record<string, unknown>,
): number | undefined {
  const rp = json.requiredPoints;
  if (typeof rp === "number" && Number.isFinite(rp)) {
    return Math.max(0, Math.floor(rp));
  }
  const legacy = json.requiredMinor;
  if (typeof legacy === "number" && Number.isFinite(legacy)) {
    return Math.max(0, Math.floor(legacy));
  }
  return undefined;
}
