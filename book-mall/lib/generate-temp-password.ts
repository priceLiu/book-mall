import { randomBytes } from "crypto";

const CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** 生成前台展示的临时登录密码（仅通过 HTTPS + 一次性响应下发） */
export function generateTempLoginPassword(length = 14): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CHARSET[bytes[i]! % CHARSET.length]!;
  }
  return out;
}
