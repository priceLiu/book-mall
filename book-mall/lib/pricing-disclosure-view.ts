/**
 * 价目公示页列/公式/成本文案的可见性。
 *
 * - 个人中心入口（`?from=account`）：一律不展示云成本、系数 M、计价公式（含管理员）。
 * - 其余入口：仅主站 ADMIN 会话展示完整字段（含从工具站链到本页且已登录主站管理员）。
 */
export function resolveShowPricingInternals(input: {
  fromAccount: boolean;
  isAdmin: boolean;
}): boolean {
  if (input.fromAccount) return false;
  return input.isAdmin;
}

export function isPricingFromAccount(searchParams: { from?: string | string[] }): boolean {
  const raw = searchParams.from;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "account";
}

/** 个人中心 → 价目公示：与 `isPricingFromAccount` 配套的 query（权限唯一入口） */
export const PRICING_DISCLOSURE_FROM_ACCOUNT_QUERY = "from=account" as const;

/** 个人中心内嵌价目页（无 hash）；旧 `/pricing-disclosure/from-account` 仍 redirect 至此 */
export const PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS = "/account/pricing" as const;

/** 个人中心 → 价目与公示（内页；锚点用于计费政策等段落） */
export function hrefPricingDisclosureFromAccount(options?: { hash?: string }): string {
  const base = PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS;
  const hash = options?.hash;
  if (!hash) return base;
  return `${base}${hash.startsWith("#") ? hash : `#${hash}`}`;
}
