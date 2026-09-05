/** 门户 BFF 在持有 SSO server secret 时写入；代理通常不会改写此头。 */
export const PLATFORM_CLIENT_IP_HEADER = "x-platform-client-ip";

export type ClientIpFromHeadersOptions = {
  /** 仅门户/内部已鉴权调用可信任此头（真实浏览器 IP） */
  trustPlatformHeader?: boolean;
};

/** 从请求头解析客户端 IP（信任反向代理 x-forwarded-for / x-real-ip）。 */

export function clientIpFromHeaders(
  headers: Headers,
  opts?: ClientIpFromHeadersOptions,
): string | null {
  if (opts?.trustPlatformHeader) {
    const platform = headers.get(PLATFORM_CLIENT_IP_HEADER)?.trim();
    if (platform) return platform.slice(0, 45);
  }
  const xf = headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 45);
  return null;
}

export function clientIpFromRequest(
  request: Request,
  opts?: ClientIpFromHeadersOptions,
): string | null {
  return clientIpFromHeaders(request.headers, opts);
}

/** 门户 BFF（Bearer SSO secret）上报的真实客户端 IP。 */
export function portalClientIpFromRequest(request: Request): string | null {
  return clientIpFromRequest(request, { trustPlatformHeader: true });
}
