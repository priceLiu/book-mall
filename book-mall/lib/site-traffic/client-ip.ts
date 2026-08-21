/** 从请求头解析客户端 IP（信任反向代理 x-forwarded-for / x-real-ip）。 */

export function clientIpFromHeaders(headers: Headers): string | null {
  const xf = headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first.slice(0, 45);
  }
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 45);
  return null;
}

export function clientIpFromRequest(request: Request): string | null {
  return clientIpFromHeaders(request.headers);
}
