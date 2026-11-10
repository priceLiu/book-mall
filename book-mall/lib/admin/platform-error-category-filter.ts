/**
 * 平台错误日志 · 运维类别（与「应用」Tab 正交：系统 / 积分对账 / 模型平台）。
 */
import type { Prisma } from "@prisma/client";

export const PLATFORM_ERROR_CREDIT_CODES = ["USAGE_RECON_MISMATCH"] as const;

export const PLATFORM_ERROR_MODEL_PLATFORM_CODES = [
  "MODEL_DAILY_LIMIT",
  "GATEWAY_HEALTH_CRITICAL",
] as const;

export const PLATFORM_ERROR_SYSTEM_CODES = [
  "LEGACY_VENDOR_ENV",
  "VENDOR_DIRECT_EGRESS",
  "VENDOR_DIRECT_BLOCKED",
] as const;

export type PlatformErrorCategoryKey =
  | ""
  | "system"
  | "credits"
  | "model-platform";

export const PLATFORM_ERROR_CATEGORY_FILTER_OPTIONS: {
  value: PlatformErrorCategoryKey;
  label: string;
}[] = [
  { value: "", label: "全部类别" },
  { value: "system", label: "系统运维" },
  { value: "credits", label: "积分与对账" },
  { value: "model-platform", label: "模型与 Gateway" },
];

export function parsePlatformErrorCategoryKey(
  raw: string | null | undefined,
): PlatformErrorCategoryKey | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v === "system" || v === "credits" || v === "model-platform") return v;
  return undefined;
}

export function buildPlatformErrorCategoryWhere(
  category: PlatformErrorCategoryKey,
): Prisma.PlatformErrorLogWhereInput {
  if (!category) return {};

  switch (category) {
    case "credits":
      return { code: { in: [...PLATFORM_ERROR_CREDIT_CODES] } };
    case "model-platform":
      return {
        OR: [
          { code: { in: [...PLATFORM_ERROR_MODEL_PLATFORM_CODES] } },
          { source: "GATEWAY" },
        ],
      };
    case "system":
      return {
        AND: [
          { source: "SYSTEM" },
          {
            NOT: { code: { in: [...PLATFORM_ERROR_CREDIT_CODES] } },
          },
        ],
      };
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}
