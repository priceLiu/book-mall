/** 将主站 story API 的 error code + message 转成用户可读文案 */
const FRIENDLY: Record<string, string> = {
  INTERNAL_ERROR: "服务器处理失败，请稍后重试。",
  upstream_fetch_failed: "无法连接主站，请确认 book-mall 已启动且地址配置正确。",
  LLM_NOT_CONFIGURED: "主站未配置 KIE_API_KEY，无法调用分镜 AI。",
  LLM_HTTP_ERROR: "分镜 AI 服务暂时不可用（网络或上游异常），请稍后重试。",
  LLM_INVALID_JSON: "AI 返回格式异常，请再试一次。",
  LLM_INVALID_OUTPUT: "AI 未返回有效分镜内容，请再试一次。",
  NOT_FOUND: "项目不存在或已被删除。",
  LLM_QUOTA_EXCEEDED: "KIE 额度不足，请充值后重试。",
  LLM_MODEL_NOT_FOUND: "分镜 AI 模型端点不可用，请联系管理员检查 KIE 配置。",
  MISSING_DEPENDENCY: "请先在「故事设定」完成一键初始化（大纲与角色）。",
  TASK_ALREADY_INFLIGHT: "分镜已存在，请使用「重新生成全部分镜」。",
  INVALID_INPUT: "分镜数量参数无效。",
  UNAUTHORIZED: "未登录，请从主站重新进入漫剧创作室。",
};

function isRedundantJsonBody(code: string, message: string): boolean {
  const t = message.trim();
  if (!t.startsWith("{")) return false;
  try {
    const o = JSON.parse(t) as { error?: string };
    return o.error === code;
  } catch {
    return false;
  }
}

export function storyApiErrorText(code: string, message: string): string {
  if (message && !isRedundantJsonBody(code, message)) {
    return message;
  }
  return FRIENDLY[code] ?? code;
}
