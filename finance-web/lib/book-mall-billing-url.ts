/**
 * @deprecated 客户端请用 `useBookMallBaseUrl()`；服务端请用 `getBookMallBaseUrlServer()`。
 * 保留仅供尚未迁移的调用方；在 client 组件中可能因构建期内联而为空。
 */
export function getBookMallBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BOOK_MALL_URL ?? "").replace(/\/$/, "");
}

export function getFinanceDevUserId(): string | undefined {
  /** 生产构建绝不允许带固定 devUserId——否则一旦主站会话 Cookie 未带到 CORS 请求，且误开 FINANCE_ALLOW_DEV_USER_QUERY，会泄漏「样板用户」明细。 */
  if (process.env.NODE_ENV === "production") return undefined;
  const v = process.env.NEXT_PUBLIC_FINANCE_DEV_USER_ID?.trim();
  return v || undefined;
}

/** 本地开发：账单页走 finance-web 服务端代理，避免 :3002→:3000 跨域 Cookie 带不上 */
export function getFinanceUseDevProxy(): boolean {
  return process.env.NEXT_PUBLIC_FINANCE_USE_DEV_PROXY === "1";
}
