/**
 * ModelCreditPrice.displayName 清洗：去掉重复拼接的档位后缀（如「720p 720p …」）。
 * 只处理空白分隔的档位词，不拆开模型名里的连字符（如 lib-nano-pro-1k）。
 */
const TIER_WORD =
  "720p|1080p|480p|360p|4k|2k|1k|768p|标准|标清|高清|2x|4x";

export function sanitizeModelCreditDisplayName(
  displayName: string,
  tierRaw?: string | null,
): string {
  const raw = displayName.trim();
  if (!raw) return raw;

  // 「Name 720p 720p 720p」→「Name 720p」
  let cleaned = raw.replace(
    new RegExp(`(\\b(?:${TIER_WORD})\\b)(?:\\s+\\1)+`, "gi"),
    "$1",
  );

  const tier = tierRaw?.trim();
  if (tier) {
    const esc = tier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(?:\\s+${esc}){2,}$`, "i");
    cleaned = cleaned.replace(re, ` ${tier}`);
  }

  return cleaned.replace(/\s{2,}/g, " ").trim();
}

/** 发布前：基名 + 档位，绝不在已有同档后缀上再叠一层 */
export function composeModelCreditDisplayName(
  baseName: string,
  tierRaw?: string | null,
): string {
  const base = sanitizeModelCreditDisplayName(baseName, tierRaw);
  const tier = tierRaw?.trim();
  if (!tier) return base;
  if (new RegExp(`\\b${tier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(base)) {
    return base;
  }
  return `${base} ${tier}`.trim();
}
