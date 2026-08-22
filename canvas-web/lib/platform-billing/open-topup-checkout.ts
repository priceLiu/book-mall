import { buildTopupHref } from "@/lib/platform-billing/build-checkout-href";
import { getBookMallOrigin } from "@/lib/site-config";

function checkoutAllowedOrigins(bookOrigin: string): string[] {
  const origins = [bookOrigin];
  if (typeof window !== "undefined") {
    origins.push(window.location.origin);
  }
  if (process.env.NODE_ENV === "development") {
    origins.push(
      "http://localhost:3000",
      "http://localhost:3003",
      "http://localhost:3004",
    );
  }
  return [...new Set(origins.map((o) => o.replace(/\/$/, "")))];
}

/** 主站积分充值深链，支付成功后回到当前页 */
export function buildCanvasTopupHref(returnTo?: string | null): string {
  const bookOrigin =
    getBookMallOrigin()?.replace(/\/$/, "") ?? "http://localhost:3000";
  const target =
    returnTo ??
    (typeof window !== "undefined" ? window.location.href : undefined);
  return buildTopupHref({
    bookOrigin,
    returnTo: target,
    allowedOrigins: checkoutAllowedOrigins(bookOrigin),
  });
}

export async function confirmOpenTopupCheckout(
  confirm: (opts: {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
  }) => Promise<boolean>,
): Promise<void> {
  const href = buildCanvasTopupHref();
  const ok = await confirm({
    title: "积分不足",
    message: "平台积分不足，是否前往主站充值？充值完成后将自动回到当前页面。",
    confirmLabel: "去充值",
    cancelLabel: "取消",
  });
  if (ok && typeof window !== "undefined") {
    window.location.href = href;
  }
}
