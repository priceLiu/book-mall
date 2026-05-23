/**
 * canvas v2 · API Key 对称加密
 *
 * 用 AES-256-GCM；密钥从 `CANVAS_SECRET_KEY` 读（base64-encoded 32 bytes）。
 * 落库格式：`v1.<iv-base64>.<cipher-base64>.<authTag-base64>`
 *
 * 使用：
 *   const blob = encryptApiKey("sk-xxxx");
 *   await prisma.canvasProvider.create({ data: { apiKeyEncrypted: blob, ... } });
 *
 *   const apiKey = decryptApiKey(provider.apiKeyEncrypted);
 *
 * 安全性：
 *   - 不可在前端直接显示明文 key；列出 Provider 时返回 maskApiKey()
 *   - 切换密钥需要做迁移（本期不做；保留 v1 标记为后续 versioning 留口）
 */

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export class CanvasSecretError extends Error {
  constructor(
    public code:
      | "CANVAS_SECRET_KEY_MISSING"
      | "CANVAS_SECRET_KEY_INVALID"
      | "CANVAS_SECRET_DECRYPT_FAILED"
      | "CANVAS_SECRET_FORMAT_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "CanvasSecretError";
  }
}

const VERSION = "v1";

function readSecretKey(): Buffer {
  const raw = process.env.CANVAS_SECRET_KEY?.trim();
  if (!raw) {
    throw new CanvasSecretError(
      "CANVAS_SECRET_KEY_MISSING",
      "CANVAS_SECRET_KEY 未配置；请在 .env.local 设置 base64 编码的 32 字节密钥（可用 `openssl rand -base64 32` 生成）。",
    );
  }
  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new CanvasSecretError(
      "CANVAS_SECRET_KEY_INVALID",
      "CANVAS_SECRET_KEY 不是合法的 base64。",
    );
  }
  if (buf.length !== 32) {
    throw new CanvasSecretError(
      "CANVAS_SECRET_KEY_INVALID",
      `CANVAS_SECRET_KEY 解码后长度应为 32 字节，当前为 ${buf.length}。`,
    );
  }
  return buf;
}

/**
 * 启动时调用以便给出明确报错（可选）。
 * 比如在 `/api/canvas/providers/*` 路由 handler 顶部调用。
 */
export function assertCanvasSecretReady(): void {
  readSecretKey();
}

export function encryptApiKey(plain: string): string {
  if (!plain) {
    throw new CanvasSecretError(
      "CANVAS_SECRET_FORMAT_INVALID",
      "API Key 不能为空。",
    );
  }
  const key = readSecretKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    VERSION,
    iv.toString("base64"),
    enc.toString("base64"),
    authTag.toString("base64"),
  ].join(".");
}

export function decryptApiKey(blob: string): string {
  const parts = (blob ?? "").split(".");
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new CanvasSecretError(
      "CANVAS_SECRET_FORMAT_INVALID",
      "加密格式无效或版本不支持。",
    );
  }
  const [, ivB64, cipherB64, tagB64] = parts;
  const key = readSecretKey();
  let iv: Buffer;
  let enc: Buffer;
  let tag: Buffer;
  try {
    iv = Buffer.from(ivB64, "base64");
    enc = Buffer.from(cipherB64, "base64");
    tag = Buffer.from(tagB64, "base64");
  } catch {
    throw new CanvasSecretError(
      "CANVAS_SECRET_FORMAT_INVALID",
      "加密载荷不是合法 base64。",
    );
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return dec.toString("utf8");
  } catch (err) {
    throw new CanvasSecretError(
      "CANVAS_SECRET_DECRYPT_FAILED",
      `API Key 解密失败：${(err as Error).message}`,
    );
  }
}

/** 显示给用户看的脱敏字符串：前 4 后 4，中间 ****。 */
export function maskApiKey(plainOrEncrypted: string): string {
  let plain = plainOrEncrypted;
  if (plainOrEncrypted.startsWith(`${VERSION}.`)) {
    try {
      plain = decryptApiKey(plainOrEncrypted);
    } catch {
      return "****";
    }
  }
  if (!plain) return "****";
  if (plain.length <= 8) return "*".repeat(plain.length);
  return `${plain.slice(0, 4)}****${plain.slice(-4)}`;
}
