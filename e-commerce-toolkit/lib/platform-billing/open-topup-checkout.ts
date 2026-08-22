import { buildTopupHref } from "@/lib/platform-billing/build-checkout-href";
import { getMainSiteOrigin } from "@/lib/site-origin";

function checkoutAllowedOrigins(bookOrigin: string): string[] {
  const origins = [bookOrigin];
  if (typeof window !== "undefined") {
    origins.push(window.location.origin);
  }
  if (process.env.NODE_ENV === "development") {
    origins.push("http://localhost:3000", "http://localhost:3007");
  }
  return [...new Set(origins.map((o) => o.replace(/\/$/, "")))];
}

export function buildEcomTopupHref(returnTo?: string | null): string {
  const bookOrigin =
    getMainSiteOrigin()?.replace(/\/$/, "") ?? "http://localhost:3000";
  const target =
    returnTo ??
    (typeof window !== "undefined" ? window.location.href : undefined);
  return buildTopupHref({
    bookOrigin,
    returnTo: target,
    allowedOrigins: checkoutAllowedOrigins(bookOrigin),
  });
}
