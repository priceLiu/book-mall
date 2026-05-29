export const GATEWAY_TOKEN_COOKIE = "gateway_token";

export function getBookMallOrigin(): string {
  const raw =
    process.env.BOOK_MALL_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  const origin = raw.replace(/\/$/, "");
  if (
    process.env.NODE_ENV === "development" &&
    origin.startsWith("https://") &&
    /localhost|127\.0\.0\.1/.test(origin)
  ) {
    console.warn(
      "[gateway] BOOK_MALL_ORIGIN 本地开发请使用 http://localhost:3000，https 可能导致 TLS 握手失败",
    );
  }
  return origin;
}

export function getGatewayPublicOrigin(): string {
  const raw =
    process.env.GATEWAY_PUBLIC_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3005" : "");
  return raw.replace(/\/$/, "");
}

export function gatewaySsoServerSecret(): string | null {
  const s =
    process.env.GATEWAY_SSO_SERVER_SECRET?.trim() ||
    process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  return s && s.length >= 16 ? s : null;
}
