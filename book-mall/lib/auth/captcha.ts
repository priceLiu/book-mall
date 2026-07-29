import { createHmac, randomInt } from "crypto";

const CAPTCHA_SECRET = process.env.NEXTAUTH_SECRET || "captcha-fallback-secret";
const CAPTCHA_TTL_MS = 5 * 60 * 1000; // 5 分钟有效

export interface CaptchaChallenge {
  question: string; // "3 + 5 = ?"
  token: string; // HMAC 签名的答案令牌
}

/**
 * 生成 10 以内加减法题目 + 签名令牌。
 * 题目格式："X + Y = ?" 或 "X - Y = ?"，保证结果 ≥ 0。
 */
export function generateCaptcha(): CaptchaChallenge {
  const a = randomInt(1, 10);
  const b = randomInt(0, 10);
  const op = randomInt(0, 2); // 0 → +, 1 → -

  let answer: number;
  let question: string;
  if (op === 0 || a < b) {
    const p = Math.max(a, b);
    const q = Math.min(a, b);
    answer = p + q;
    question = `${p} + ${q} = ?`;
  } else {
    answer = a - b;
    question = `${a} - ${b} = ?`;
  }

  const expiresAt = Date.now() + CAPTCHA_TTL_MS;
  const payload = `${answer}|${expiresAt}`;
  const hmac = createHmac("sha256", CAPTCHA_SECRET).update(payload).digest("hex");
  const token = `${hmac}.${payload}`;

  return { question, token };
}

/**
 * 验证 captcha 答案。
 * @returns true 表示答案正确且令牌未过期
 */
export function verifyCaptcha(token: string, answer: number): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [receivedHmac, payload] = parts;
    const expectedHmac = createHmac("sha256", CAPTCHA_SECRET).update(payload).digest("hex");
    if (receivedHmac !== expectedHmac) return false;

    const payloadParts = payload.split("|");
    if (payloadParts.length !== 2) return false;

    const correctAnswer = parseInt(payloadParts[0], 10);
    const expiresAt = parseInt(payloadParts[1], 10);

    if (Date.now() > expiresAt) return false;
    if (answer !== correctAnswer) return false;

    return true;
  } catch {
    return false;
  }
}
