/** @generated — 勿手改；改 shared/platform-billing 后运行 node scripts/sync-platform-billing.mjs */

import { buildTopupHref } from "./build-checkout-href";

export function checkoutAllowedOriginsForApp(bookOrigin: string): string[] {
  const base = bookOrigin.replace(/\/$/, "");
  const origins = [base];
  if (typeof window !== "undefined") {
    origins.push(window.location.origin);
  }
  if (process.env.NODE_ENV === "development") {
    origins.push(
      "http://localhost:3000",
      "http://localhost:3003",
      "http://localhost:3004",
      "http://localhost:3006",
      "http://localhost:3010",
      "http://localhost:3012",
    );
  }
  return [...new Set(origins)];
}

function resolveReturnTo(returnTo?: string | null): string | undefined {
  return (
    returnTo ??
    (typeof window !== "undefined" ? window.location.href : undefined)
  );
}

/** 子应用 → 主站轻量包选档页 */
export function buildAppBillingHref(
  bookOrigin: string,
  returnTo?: string | null,
): string {
  const base = bookOrigin.replace(/\/$/, "");
  const params = new URLSearchParams();
  const safe = buildTopupHref({
    bookOrigin: base,
    returnTo: resolveReturnTo(returnTo),
    allowedOrigins: checkoutAllowedOriginsForApp(bookOrigin),
  });
  const parsed = new URL(safe);
  const rt = parsed.searchParams.get("returnTo");
  if (rt) params.set("returnTo", rt);
  const q = params.toString();
  return `${base}/account/billing${q ? `?${q}` : ""}`;
}

/** 子应用 → 主站订阅报价页（会员到期续费） */
export function buildAppPricingHref(
  bookOrigin: string,
  returnTo?: string | null,
): string {
  const base = bookOrigin.replace(/\/$/, "");
  const params = new URLSearchParams();
  const safe = buildTopupHref({
    bookOrigin: base,
    returnTo: resolveReturnTo(returnTo),
    allowedOrigins: checkoutAllowedOriginsForApp(bookOrigin),
  });
  const parsed = new URL(safe);
  const rt = parsed.searchParams.get("returnTo");
  if (rt) params.set("returnTo", rt);
  const q = params.toString();
  return `${base}/pricing${q ? `?${q}` : ""}`;
}

/**
 * 子应用顶栏「积分充值」统一入口（主站 /account/recharge 按会员状态分流）。
 * 积分不足弹层等快捷路径仍可用 buildAppTopupHref 直达 checkout。
 */
export function buildAppRechargeEntryHref(
  bookOrigin: string,
  returnTo?: string | null,
): string {
  const base = bookOrigin.replace(/\/$/, "");
  const params = new URLSearchParams();
  const safe = buildTopupHref({
    bookOrigin: base,
    returnTo: resolveReturnTo(returnTo),
    allowedOrigins: checkoutAllowedOriginsForApp(bookOrigin),
  });
  const parsed = new URL(safe);
  const rt = parsed.searchParams.get("returnTo");
  if (rt) params.set("returnTo", rt);
  const q = params.toString();
  return `${base}/account/recharge${q ? `?${q}` : ""}`;
}

/** 子应用 → 主站 checkout 深链（积分不足等已知档位快捷支付） */
export function buildAppTopupHref(
  bookOrigin: string,
  returnTo?: string | null,
): string {
  return buildTopupHref({
    bookOrigin: bookOrigin.replace(/\/$/, ""),
    returnTo: resolveReturnTo(returnTo),
    allowedOrigins: checkoutAllowedOriginsForApp(bookOrigin),
  });
}
