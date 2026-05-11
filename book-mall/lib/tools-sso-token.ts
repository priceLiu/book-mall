import { createHmac, timingSafeEqual } from "crypto";

export const TOOLS_JWT_AUDIENCE = "book-mall-tools";

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

export function signToolsAccessToken(opts: {
  userId: string;
  secret: string;
  expiresInSec: number;
}): string {
  const header = base64UrlEncodeJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncodeJson({
    sub: opts.userId,
    aud: TOOLS_JWT_AUDIENCE,
    tier: "gold",
    iat: now,
    exp: now + opts.expiresInSec,
  });
  const data = `${header}.${payload}`;
  const sig = createHmac("sha256", opts.secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${sig}`;
}

export type VerifiedToolsToken = {
  sub: string;
  aud: string;
  tier: string;
  exp: number;
};

export function verifyToolsAccessToken(
  token: string,
  secret: string,
): VerifiedToolsToken | null {
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
  let payload: VerifiedToolsToken;
  try {
    payload = JSON.parse(base64UrlDecodeToString(p)) as VerifiedToolsToken;
  } catch {
    return null;
  }
  if (payload.aud !== TOOLS_JWT_AUDIENCE) return null;
  if (typeof payload.exp !== "number" || payload.exp * 1000 < Date.now()) {
    return null;
  }
  if (typeof payload.sub !== "string" || !payload.sub) return null;
  return payload;
}
