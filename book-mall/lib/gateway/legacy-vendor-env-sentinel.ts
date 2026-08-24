/**
 * 废弃厂商直连 env 哨兵。
 *
 * 背景：历史 canvas Key（sk-918f…）经 `DEEPSEEK_API_KEY` env 被旧进程直连扣费，
 * 平台侧无任何记录。boot 时扫描这类 env，写 PlatformErrorLog（source=SYSTEM），
 * /admin/errors 即可见：哪个实例（context.runtime.host）、带哪把 key（指纹）启动。
 *
 * 只记录 sha256 指纹前 12 位，绝不落 key 原文。
 */
import { createHash } from "node:crypto";

import { recordPlatformError } from "@/lib/platform-error-log";

/** 已废弃、存在即危险的厂商直连 env（仍在合法使用的如 KIE_API_KEY 不在此列） */
export const LEGACY_VENDOR_ENV_VARS = ["DEEPSEEK_API_KEY"] as const;

export type LegacyVendorEnvHit = {
  name: string;
  /** sha256(value) 前 12 位；用于区分「哪把 key」，不泄露原文 */
  keyFingerprint: string;
};

export function vendorKeyFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function scanLegacyVendorEnvs(
  env: NodeJS.ProcessEnv = process.env,
): LegacyVendorEnvHit[] {
  const hits: LegacyVendorEnvHit[] = [];
  for (const name of LEGACY_VENDOR_ENV_VARS) {
    const v = env[name]?.trim();
    if (v) hits.push({ name, keyFingerprint: vendorKeyFingerprint(v) });
  }
  return hits;
}

/** boot 时调用：命中则 console.error + 落 PlatformErrorLog（fire-and-forget）。返回命中数。 */
export function reportLegacyVendorEnvs(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const hits = scanLegacyVendorEnvs(env);
  for (const hit of hits) {
    console.error(
      `[book-mall] ${hit.name} 已废弃且会导致绕过 Gateway 的厂商直连扣费；` +
        `请从 env 删除（key 指纹 ${hit.keyFingerprint}）。厂商调用仅经 Gateway（gw-* Key）。`,
    );
    recordPlatformError({
      source: "SYSTEM",
      severity: "ERROR",
      code: "LEGACY_VENDOR_ENV",
      message: `检测到废弃厂商直连 env：${hit.name}（可绕过 Gateway 直连扣费，须删除）`,
      context: {
        envVar: hit.name,
        keyFingerprint: hit.keyFingerprint,
      },
    });
  }
  return hits.length;
}
