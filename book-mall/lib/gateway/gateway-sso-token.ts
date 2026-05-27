import { createHmac, timingSafeEqual } from "crypto";

export const GATEWAY_JWT_AUDIENCE = "book-mall-gateway";

function base64UrlEncodeJson(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecodeToString(segment: string): string {
  let b = segment.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return Buffer.from(b, "base64").toString("utf8");
}

export function signGatewayAccessToken(opts: {
  gatewayUserId: string;
  secret: string;
  expiresInSec: number;
  profile?: { email?: string | null; name?: string | null; image?: string | null };
}): string {
  const header = base64UrlEncodeJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payloadObj: Record<string, unknown> = {
    sub: opts.gatewayUserId,
    aud: GATEWAY_JWT_AUDIENCE,
    iat: now,
    exp: now + opts.expiresInSec,
  };
  const email = opts.profile?.email?.trim();
  const name = opts.profile?.name?.trim();
  if (email) payloadObj.email = email.slice(0, 320);
  if (name) payloadObj.name = name.slice(0, 120);
  const payload = base64UrlEncodeJson(payloadObj);
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", opts.secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sig}`;
}

export type VerifiedGatewayToken = {
  sub: string;
  aud: string;
  exp: number;
  email?: string;
  name?: string;
};

export function verifyGatewayAccessToken(
  token: string,
  secret: string,
): VerifiedGatewayToken | null {
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;
  const [h, p, s] = parts;
  const data = `${h}.${p}`;
  const expected = createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  if (expected.length !== s.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(s))) return null;
  } catch {
    return null;
  }
  let payloadRaw: Record<string, unknown>;
  try {
    payloadRaw = JSON.parse(base64UrlDecodeToString(p)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (payloadRaw.aud !== GATEWAY_JWT_AUDIENCE) return null;
  if (typeof payloadRaw.exp !== "number" || payloadRaw.exp * 1000 < Date.now()) {
    return null;
  }
  if (typeof payloadRaw.sub !== "string" || !payloadRaw.sub) return null;
  return {
    sub: payloadRaw.sub,
    aud: GATEWAY_JWT_AUDIENCE,
    exp: payloadRaw.exp,
    email: typeof payloadRaw.email === "string" ? payloadRaw.email : undefined,
    name: typeof payloadRaw.name === "string" ? payloadRaw.name : undefined,
  };
}
