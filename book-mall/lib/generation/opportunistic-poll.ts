/**
 * Gen-HotCold-R2 Phase 1 · 读路径 opportunistic poll 兜底开关。
 *
 * 设计：进度推进的「真相」由独立 poll-loop / cron 进程负责（生产）。
 * Web 读路径（日志页 / 状态页 / 画布任务读 / 项目读）默认 **不再** 触发重 poll，
 * 避免「越看越卡」——读页面把连接池打满、与「点生成」抢连接。
 *
 * 仅当以 `dev:all:nopoll` 等无后台 poll-loop 的模式运行时，
 * 才把该开关打开（env `CANVAS_OPPORTUNISTIC_POLL=1`），让读路径兜底推进进度。
 */
export function isOpportunisticPollFallbackEnabled(): boolean {
  const v = process.env.CANVAS_OPPORTUNISTIC_POLL?.trim().toLowerCase();
  return v === "1" || v === "true";
}
