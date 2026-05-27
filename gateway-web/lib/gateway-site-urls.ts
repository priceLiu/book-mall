/** Gateway / Book 站点 URL（静态页、指引共用） */

export function getBookMallOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_BOOK_MALL_ORIGIN?.trim() || "http://localhost:3000"
  ).replace(/\/$/, "");
}

export function bookAccountGatewayUrl(): string {
  return `${getBookMallOrigin()}/account#gateway-api-key`;
}

export function bookSsoGatewayIssueUrl(redirect = "/dashboard"): string {
  return `${getBookMallOrigin()}/api/sso/gateway/issue?redirect=${encodeURIComponent(redirect)}`;
}
