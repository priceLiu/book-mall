/** book-mall 基础 URL，如 http://localhost:3000 */
export function getBookMallBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_BOOK_MALL_URL ?? "").replace(/\/$/, "");
}

export function getFinanceDevUserId(): string | undefined {
  const v = process.env.NEXT_PUBLIC_FINANCE_DEV_USER_ID?.trim();
  return v || undefined;
}

/** 本地开发：账单页走 finance-web 服务端代理，避免 :3002→:3000 跨域 Cookie 带不上 */
export function getFinanceUseDevProxy(): boolean {
  return process.env.NEXT_PUBLIC_FINANCE_USE_DEV_PROXY === "1";
}
