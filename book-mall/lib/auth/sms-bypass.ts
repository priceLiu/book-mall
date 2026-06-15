/**
 * 腾讯云短信未开通前的临时 bypass：
 * 8 位 = 6 个英文字母 + 2 个数字 → 仅校验手机号格式，不校验短信记录。
 * 测试号段 67890xxxxxx 同样走 bypass（见 phone.ts TEST_PHONE_PREFIX）。
 * 正式开通后设 SMS_ALLOW_BYPASS_CODE=0 关闭。
 */

import { randomInt } from "crypto";

import { isTestPrefixPhone, normalizePhone } from "@/lib/auth/phone";

/** 生成可写入邀请链接的 bypass 验证码（6 字母 + 2 数字）。 */
export function generateInviteBypassCode(): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += letters[randomInt(letters.length)]!;
  }
  s += String(randomInt(10)) + String(randomInt(10));
  return s;
}

/** 8 位字母数字：6 字母+2 数字，或 6 数字+2 字母（顺序不限） */
export function isSmsBypassCode(code: string): boolean {
  const c = code.trim();
  if (c.length !== 8) return false;
  let letters = 0;
  let digits = 0;
  for (const ch of c) {
    if (/[A-Za-z]/.test(ch)) letters += 1;
    else if (/\d/.test(ch)) digits += 1;
    else return false;
  }
  return (
    (letters === 6 && digits === 2) || (letters === 2 && digits === 6)
  );
}

export function isValidSmsCodeInput(code: string): boolean {
  const c = code.trim();
  return /^\d{6}$/.test(c) || isSmsBypassCode(c);
}

/** 未显式设为 0 时允许 bypass（短信开通后生产环境须 SMS_ALLOW_BYPASS_CODE=0） */
export function allowSmsBypassCode(): boolean {
  return process.env.SMS_ALLOW_BYPASS_CODE?.trim() !== "0";
}

export function verifySmsBypass(input: { phoneNormalized: string | null; code: string }): boolean {
  if (!input.phoneNormalized) return false;
  if (!isSmsBypassCode(input.code)) return false;
  // 67890 测试号：仅格式 + bypass 码即可（团队邀请等同）
  if (isTestPrefixPhone(input.phoneNormalized)) return true;
  if (!allowSmsBypassCode()) return false;
  return normalizePhone(input.phoneNormalized) != null;
}
