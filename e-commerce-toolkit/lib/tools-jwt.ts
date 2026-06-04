import { createHmac, timingSafeEqual } from "crypto";

export const TOOLS_JWT_AUDIENCE = "book-mall-tools";

function base64UrlDecodeToString(segment: string): string {
  let b = segment.replace(/-/g, "+").replace(/_/g, "/");
  while (b.length % 4) b += "=";
  return Buffer.from(b, "base64").toString("utf8");
}

export type ToolsJwtPayload = {
  sub: string;
  tier: "gold" | "admin";
  toolsNavKeys?: string[];
  ecomBillingMode?: string;
  exp: number;
};

export function verifyToolsJwt(
  token: string,
  secret: string,
): ToolsJwtPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expected = createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(base64UrlDecodeToString(payload)) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (parsed.aud !== TOOLS_JWT_AUDIENCE) return null;
  const exp = typeof parsed.exp === "number" ? parsed.exp : 0;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  const sub = typeof parsed.sub === "string" ? parsed.sub : "";
  if (!sub) return null;
  const tier = parsed.tier === "admin" ? "admin" : "gold";
  const toolsNavKeys = Array.isArray(parsed.tools_nav_keys)
    ? (parsed.tools_nav_keys as unknown[]).filter((k) => typeof k === "string")
    : undefined;
  const ecomBillingMode =
    typeof parsed.ecom_billing_mode === "string"
      ? parsed.ecom_billing_mode
      : undefined;
  return { sub, tier, toolsNavKeys, ecomBillingMode, exp };
}
