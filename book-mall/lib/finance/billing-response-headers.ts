/**
 * 账单类 API 为**用户级私密数据**，禁止 CDN/共享缓存命中他人会话的响应。
 */
export type BillingResponseVary = "Cookie" | "Authorization";

export function billingPrivateCacheHeaders(vary: BillingResponseVary): Record<string, string> {
  return {
    "Cache-Control": "private, no-store, max-age=0, must-revalidate",
    Vary: vary,
  };
}
