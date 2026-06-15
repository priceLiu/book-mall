/** 大陆手机号归一化与校验 */

const CN_MOBILE_RE = /^1[3-9]\d{9}$/;

/** 测试号段：前 5 位 67890 + 后 6 位数字（共 11 位），不走真实短信校验 */
export const TEST_PHONE_PREFIX = "67890";
const TEST_PHONE_RE = /^67890\d{6}$/;

/** 归一化为 11 位大陆手机号或测试号；无效返回 null */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim().replace(/\s+/g, "");
  if (s.startsWith("+86")) s = s.slice(3);
  else if (s.startsWith("0086")) s = s.slice(4);
  else if (s.startsWith("86") && s.length === 13) s = s.slice(2);
  s = s.replace(/\D/g, "");
  if (CN_MOBILE_RE.test(s) || TEST_PHONE_RE.test(s)) return s;
  return null;
}

/** 67890xxxxxx 测试号（仅校验 11 位格式 + bypass 验证码，不发真实短信） */
export function isTestPrefixPhone(phone: string): boolean {
  const p = normalizePhone(phone);
  if (!p) return false;
  return p.startsWith(TEST_PHONE_PREFIX);
}

export function isValidCnPhone(raw: string | null | undefined): boolean {
  return normalizePhone(raw) != null;
}

/** 138****8000 */
export function maskPhone(phone: string): string {
  const p = normalizePhone(phone);
  if (!p || p.length !== 11) return phone;
  return `${p.slice(0, 3)}****${p.slice(7)}`;
}

/** Mock 测试号段 13800000001–13800000009 */
export function isMockSmsPhone(phone: string): boolean {
  const p = normalizePhone(phone);
  if (!p) return false;
  const n = Number(p);
  return n >= 13800000001 && n <= 13800000009;
}

export const MOCK_SMS_CODE = "888888";

export function toE164Cn(phone: string): string {
  const p = normalizePhone(phone);
  if (!p) throw new Error("无效手机号");
  return `+86${p}`;
}
