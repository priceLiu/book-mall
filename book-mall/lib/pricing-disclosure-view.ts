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
