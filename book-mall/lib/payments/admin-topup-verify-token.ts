import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_MS = 5 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET?.trim();
  if (!s) throw new Error("NEXTAUTH_SECRET 未配置");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** 管理员专用包：短信验证通过后签发，用于创建 checkout。 */
export function issueAdminTopupVerifyToken(
  userId: string,
  packId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${packId}.${exp}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyAdminTopupVerifyToken(
  token: string | null | undefined,
  userId: string,
  packId: string,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return false;
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const [tokenUserId, tokenPackId, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!tokenUserId || !tokenPackId || !Number.isFinite(exp) || exp < Date.now()) return false;
  return tokenUserId === userId && tokenPackId === packId;
}
