import type { NextRequest } from "next/server";

/**
 * CloudBase Run 会按 `FINANCE_WEB_ORIGINS` 在网关层注入 CORS。
 * 应用层再返回同名头会导致重复的 `Access-Control-Allow-Origin`，浏览器报 Failed to fetch。
 * 非 CloudBase 的自托管生产可设 `FINANCE_CORS_IN_APP=1` 强制由本函数写头。
 */
function appFinanceCorsEnabled(): boolean {
  if (process.env.FINANCE_CORS_IN_APP?.trim() === "1") return true;
  if (process.env.NODE_ENV !== "production") return true;
  return !process.env.FINANCE_WEB_ORIGINS?.trim();
}

/** finance-web 等跨源前端；生产请设为实际域名列表，逗号分隔。 */
export function financeCorsHeaders(request: NextRequest): Record<string, string> {
  if (!appFinanceCorsEnabled()) return {};

  const origin = request.headers.get("origin");
  const allowed = (process.env.FINANCE_WEB_ORIGINS ?? "http://localhost:3002")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (origin && allowed.includes(origin)) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
  }
  return {};
}
