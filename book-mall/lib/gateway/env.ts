export function getGatewayPublicOrigin(): string | null {
  const raw =
    process.env.GATEWAY_PUBLIC_ORIGIN?.trim() ||
    process.env.NEXT_PUBLIC_GATEWAY_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3005" : "");
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function getBookMallOrigin(): string | null {
  const raw =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.BOOK_MALL_ORIGIN?.trim() ||
    (process.env.NODE_ENV === "development" ? "http://localhost:3000" : "");
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

export function requireGatewayJwtSecret(): string {
  const s =
    process.env.GATEWAY_JWT_SECRET?.trim() ||
    process.env.TOOLS_JWT_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("GATEWAY_JWT_SECRET 未配置或太短");
  }
  return s;
}

export function requireGatewaySsoServerSecret(): string {
  const s =
    process.env.GATEWAY_SSO_SERVER_SECRET?.trim() ||
    process.env.TOOLS_SSO_SERVER_SECRET?.trim();
  if (!s || s.length < 16) {
    throw new Error("GATEWAY_SSO_SERVER_SECRET 未配置或太短");
  }
  return s;
}

export function gatewaySsoExchangeAuthorized(req: Request): boolean {
  const expected = requireGatewaySsoServerSecret();
  const auth = req.headers.get("authorization")?.trim() ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  return auth.slice(7).trim() === expected;
}

export function getGatewayJwtTtlSec(): number {
  const n = Number(process.env.GATEWAY_JWT_TTL_SEC ?? "86400");
  return Number.isFinite(n) && n > 60 ? Math.floor(n) : 86400;
}

export function getGatewaySsoCodeTtlSec(): number {
  const n = Number(process.env.GATEWAY_SSO_CODE_TTL_SEC ?? "120");
  return Number.isFinite(n) && n > 10 ? Math.floor(n) : 120;
}

export function getGatewayKieCallbackToken(): string | null {
  return (
    process.env.GATEWAY_KIE_CALLBACK_TOKEN?.trim() ||
    process.env.KIE_CALLBACK_TOKEN?.trim() ||
    null
  );
}
