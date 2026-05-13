/**
 * DashScope 图生视频异步任务失败时，将 code/message 转为用户可读中文说明。
 * 例：DataInspectionFailed + Green net check failed for image input
 */

export type DashScopeI2vTaskFailureFields = {
  task_status?: string;
  code?: string;
  message?: string;
};

export function formatDashScopeI2vFailureForUser(
  output: DashScopeI2vTaskFailureFields | null | undefined,
  fallbackStatus = "UNKNOWN",
): string {
  const code = typeof output?.code === "string" ? output.code.trim() : "";
  const message = typeof output?.message === "string" ? output.message.trim() : "";

  if (
    code === "DataInspectionFailed" ||
    /data\s*inspection/i.test(message) ||
    /green\s*net/i.test(message)
  ) {
    return "首帧图片未通过平台内容安全审核（绿网检测）。请更换其它首张图或示例图后再试。";
  }

  if (message) return message;
  if (code) return code;
  const st = typeof output?.task_status === "string" ? output.task_status.trim() : "";
  return st || fallbackStatus;
}
