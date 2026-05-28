/**
 * 与 book-mall/lib/tools-sso-token.ts 保持算法与 aud 一致；变更时请双向同步。
 */
import { createHmac, timingSafeEqual } from "crypto";

export const TOOLS_JWT_AUDIENCE = "book-mall-tools";

function base64UrlDecodeToString(segment: string): string {
  let b = segment.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return Buffer.from(b, "base64").toString("utf8");
}

export type VerifiedToolsJwt = {
  sub: string;
  tier: "gold" | "admin";
  exp: number;
  email?: string;
  name?: string;
  image?: string;
  toolsNavKeys?: string[];
};

function pickTier(raw: unknown): "gold" | "admin" | null {
  if (raw === "gold" || raw === "admin") return raw;
  return null;
}

function pickToolsNavKeys(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== "string") continue;
    const t = x.trim();
    if (!t || t.length > 64 || out.length >= 24) continue;
    out.push(t);
  }
  return out.length > 0 ? out : undefined;
}

function pickClaim(raw: unknown, maxLen: number): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t || t.length > maxLen) return undefined;
  return t;
}

/**
 * 本地校验工具站 access JWT（HS256）；仅供服务端读取 Cookie 后调用。
 */
export function verifyToolsJwt(token: string, secret: string): VerifiedToolsJwt | null {
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

  if (payloadRaw.aud !== TOOLS_JWT_AUDIENCE) return null;
  if (typeof payloadRaw.exp !== "number" || payloadRaw.exp * 1000 < Date.now()) {
    return null;
  }
  if (typeof payloadRaw.sub !== "string" || !payloadRaw.sub) return null;

  const tier = pickTier(payloadRaw.tier);
  if (!tier) return null;

  const email = pickClaim(payloadRaw.email, 320);
  const name = pickClaim(payloadRaw.name, 120);
  const imageRaw = pickClaim(payloadRaw.image, 768);
  const image =
    imageRaw && /^https?:\/\//i.test(imageRaw)
      ? imageRaw
      : undefined;

  const out: VerifiedToolsJwt = { sub: payloadRaw.sub, tier, exp: payloadRaw.exp };
  if (email) out.email = email;
  if (name) out.name = name;
  if (image) out.image = image;

  const tnk = pickToolsNavKeys(payloadRaw.tools_nav_keys);
  if (tnk) out.toolsNavKeys = tnk;

  return out;
}
