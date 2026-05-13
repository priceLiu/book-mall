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

function trimClaim(s: string | null | undefined, maxLen: number): string | undefined {
  if (s == null || typeof s !== "string") return undefined;
  const t = s.trim();
  if (!t) return undefined;
  return t.length > maxLen ? t.slice(0, maxLen) : t;
}

export function signToolsAccessToken(opts: {
  userId: string;
  secret: string;
  expiresInSec: number;
  /** 主站签发：`gold` 会员工具准入，`admin` 为管理员直通（仍须 introspect 复核敏感路径）。 */
  tier?: "gold" | "admin";
  /** 工具站分组 navKey，不含套件外的自定义字符串（长度裁剪）。 */
  toolsNavKeys?: readonly string[];
  /** 写入 JWT，供工具站壳层本地验签展示（字段受限以防 Cookie 过大） */
  profile?: {
    email?: string | null;
    name?: string | null;
    image?: string | null;
  };
}): string {
  const header = base64UrlEncodeJson({ alg: "HS256", typ: "JWT" });
  const now = Math.floor(Date.now() / 1000);
  const tier = opts.tier ?? "gold";
  const payloadObj: Record<string, unknown> = {
    sub: opts.userId,
    aud: TOOLS_JWT_AUDIENCE,
    tier,
    iat: now,
    exp: now + opts.expiresInSec,
  };

  const keys =
    opts.toolsNavKeys?.flatMap((k) => {
      const t = String(k).trim();
      if (!t || t.length > 64) return [];
      return [t];
    }) ?? [];
  if (keys.length > 0) {
    payloadObj.tools_nav_keys = keys.slice(0, 24);
  }
  const email = trimClaim(opts.profile?.email, 320);
  const name = trimClaim(opts.profile?.name, 120);
  let image = trimClaim(opts.profile?.image, 768);
  if (image && !/^https?:\/\//i.test(image)) {
    image = undefined;
  }
  if (email) payloadObj.email = email;
  if (name) payloadObj.name = name;
  if (image) payloadObj.image = image;

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

export type VerifiedToolsToken = {
  sub: string;
  aud: string;
  tier: "gold" | "admin";
  exp: number;
  email?: string;
  name?: string;
  image?: string;
  /** 可能为空数组或省略（旧 JWT）；工具站应回落 introspect。 */
  tools_nav_keys?: string[];
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
  let image = pickClaim(payloadRaw.image, 768);
  if (image && !/^https?:\/\//i.test(image)) {
    image = undefined;
  }

  const out: VerifiedToolsToken = {
    sub: payloadRaw.sub,
    aud: TOOLS_JWT_AUDIENCE,
    tier,
    exp: payloadRaw.exp,
  };
  if (email) out.email = email;
  if (name) out.name = name;
  if (image) out.image = image;

  const tnk = pickToolsNavKeys(payloadRaw.tools_nav_keys);
  if (tnk) out.tools_nav_keys = tnk;

  return out;
}
