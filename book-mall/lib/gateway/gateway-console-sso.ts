/** Book → Gateway 控制台 SSO 跳转（/api/sso/gateway/issue） */
export function buildGatewayConsoleSsoHref(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `/api/sso/gateway/issue?redirect=${encodeURIComponent(normalized)}`;
}

export const GATEWAY_LOGS_SSO_HREF = buildGatewayConsoleSsoHref("/dashboard/logs");
