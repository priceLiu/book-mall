import { getFinanceWebPublicOrigin } from "@/lib/finance-web-public-url";

const FROM_ACCOUNT = "from=account";

/** 个人中心 → finance-web 费用区（带 from=account）。未配置 Origin 时返回 null。 */
export function getFinanceFeesRedirectUrl(path: string): string | null {
  const origin = getFinanceWebPublicOrigin();
  if (!origin) return null;
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const sep = normalized.includes("?") ? "&" : "?";
  return `${origin}${normalized}${sep}${FROM_ACCOUNT}`;
}
