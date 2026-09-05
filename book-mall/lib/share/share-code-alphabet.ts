import { randomBytes } from "node:crypto";

/** 去掉易混淆 I O 0 1 */
export const SHARE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const REFERRAL_CODE_LENGTH = 8;
export const REFERRAL_PREFIX_LENGTH = 2;
export const REFERRAL_SUFFIX_LENGTH = 6;

export const WORKFLOW_CODE_LENGTH = 10;
export const WORKFLOW_PREFIX_LENGTH = 4;
export const WORKFLOW_SUFFIX_LENGTH = 6;

export const SHARE_CODE_INVALID_MESSAGE = "分享码无效或已失效";

export function normalizeShareCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidShareCodeCharset(code: string): boolean {
  if (!code) return false;
  for (const ch of code) {
    if (!SHARE_CODE_ALPHABET.includes(ch)) return false;
  }
  return true;
}

export function generateShareCodeSuffix(length: number): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += SHARE_CODE_ALPHABET[bytes[i] % SHARE_CODE_ALPHABET.length];
  }
  return out;
}

export function buildShareCodePageUrl(baseUrl: string, code: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return `${base}/code/${encodeURIComponent(code)}`;
}
