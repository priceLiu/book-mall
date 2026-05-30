import type { GatewayApiKeyScope } from "@prisma/client";

/** 全站管理员 sk-gw 固定显示名（英文） */
export const PLATFORM_ADMIN_KEY_NAME = "Platform Admin";

/** 个人 sk-gw 默认显示名（英文） */
export const PERSONAL_KEY_DEFAULT_NAME = "Personal Key";

/** 迁移前曾用的全站 Key 名称 */
export const LEGACY_PLATFORM_KEY_NAMES = ["Canvas Pilot", "全站 Gateway"] as const;

export function isLegacyPlatformKeyName(name: string): boolean {
  return (LEGACY_PLATFORM_KEY_NAMES as readonly string[]).includes(name.trim());
}

export function scopeLabel(scope: GatewayApiKeyScope): string {
  return scope === "PLATFORM" ? "Platform Admin" : "Personal";
}
