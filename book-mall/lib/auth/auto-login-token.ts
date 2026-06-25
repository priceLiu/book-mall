import { createHmac, timingSafeEqual } from "crypto";

/**
 * 一次性自动登录票据（仅用于注册成功后免密自动登录）。
 *
 * 由服务端用 NEXTAUTH_SECRET 进行 HMAC 签名，含 userId 与过期时间，默认 2 分钟。
 * 不落库、单向校验，足以覆盖「注册成功 → 立即建会话」这一窄场景；
 * 长期登录仍走密码或短信 OTP。
 */

const DEFAULT_TTL_MS = 2 * 60 * 1000;

function secret(): string {
  const s = process.env.NEXTAUTH_SECRET?.trim();
  if (!s) throw new Error("NEXTAUTH_SECRET 未配置");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function issueAutoLoginToken(
  userId: string,
  ttlMs: number = DEFAULT_TTL_MS,
): string {
  const exp = Date.now() + ttlMs;
  const payload = `${userId}.${exp}`;
  const sig = sign(payload);
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyAutoLoginToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sig] = parts;
  let payload: string;
  try {
    payload = Buffer.from(payloadB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = sign(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  const [userId, expStr] = payload.split(".");
  const exp = Number(expStr);
  if (!userId || !Number.isFinite(exp) || exp < Date.now()) return null;
  return userId;
}
