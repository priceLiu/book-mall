import { getBookMallBaseUrlServer } from "@/lib/book-mall-base-url.server";
import {
  FEES_FROM_ACCOUNT_QUERY,
  FEES_FROM_ACCOUNT_VALUE,
} from "@/lib/fees-from-account";

/** finance-web 费用区须从 Book 个人中心进入（?from=account）。 */
export function hasFeesBookEntry(searchParams: URLSearchParams): boolean {
  return searchParams.get(FEES_FROM_ACCOUNT_QUERY) === FEES_FROM_ACCOUNT_VALUE;
}

/** 未带 Book 入口参数时，将 /fees/* 映射回主站个人中心对应页。 */
export function mapFeesPathToBookAccountPath(pathname: string): string {
  if (pathname.startsWith("/fees/billing/details")) return "/account/fees/details";
  if (pathname.startsWith("/fees/billing/ledger")) return "/account/fees/ledger";
  if (pathname.startsWith("/fees/billing/subscriptions")) return "/account/billing";
  if (pathname.startsWith("/fees/billing/overview")) return "/account/billing";
  if (pathname.startsWith("/fees/usage")) return "/account/usage";
  if (pathname.startsWith("/fees/billing")) return "/account/fees/details";
  return "/account/usage";
}

export function bookAccountRedirectUrl(pathname: string): string | null {
  const base = getBookMallBaseUrlServer();
  if (!base) return null;
  const bookPath = mapFeesPathToBookAccountPath(pathname);
  return `${base}${bookPath}`;
}

export function bookAdminHomeUrl(): string | null {
  const base = getBookMallBaseUrlServer();
  if (!base) return null;
  return `${base}/admin`;
}

export function bookAccountHomeUrl(): string | null {
  const base = getBookMallBaseUrlServer();
  if (!base) return null;
  return `${base}/account`;
}
