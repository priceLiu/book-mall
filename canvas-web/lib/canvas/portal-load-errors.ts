/** 门户公开内容加载失败 · 是否为未登录/会话类错误（首页访客可忽略，不展示红字） */
export function isPortalGuestAuthLoadError(message: string): boolean {
  return /401|UNAUTHORIZED|登录连接已断开|无效或过期的工具令牌/i.test(message);
}

export function portalLoadErrorMessage(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback;
}

/** 三路门户列表是否全部请求失败 */
export function didPortalListLoadFail(
  results: PromiseSettledResult<unknown>[],
): boolean {
  return results.length > 0 && results.every((r) => r.status === "rejected");
}
