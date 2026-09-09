/**
 * 价目公示页列/公式/成本文案的可见性。
 *
 * 对外（book-mall 订阅页、价格公示、个人中心链入）一律不展示：
 * 云成本、系数 M、计价公式。财务后台见 finance-web `/admin/*`。
 */
export function resolveShowPricingInternals(_input: {
  fromAccount: boolean;
  isAdmin: boolean;
}): boolean {
  void _input;
  return false;
}

export function isPricingFromAccount(searchParams: { from?: string | string[] }): boolean {
  const raw = searchParams.from;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "account";
}

/** 个人中心 → 价目公示：与 `isPricingFromAccount` 配套的 query（权限唯一入口） */
export const PRICING_DISCLOSURE_FROM_ACCOUNT_QUERY = "from=account" as const;

/** 个人中心链到公示页（带 from=account 隐藏成本列） */
export const PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS =
  `/pricing-disclosure?${PRICING_DISCLOSURE_FROM_ACCOUNT_QUERY}` as const;

/** 个人中心 → 价目与公示（锚点用于计费政策等段落） */
export function hrefPricingDisclosureFromAccount(options?: { hash?: string }): string {
  const base = PRICING_DISCLOSURE_FROM_ACCOUNT_ALIAS;
  const hash = options?.hash;
  if (!hash) return base;
  return `${base}${hash.startsWith("#") ? hash : `#${hash}`}`;
}
