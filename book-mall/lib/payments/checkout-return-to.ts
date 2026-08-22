import {
  getCanvasWebOrigin,
  getCommonToolsOrigin,
  getDirectorWebOrigin,
  getEcommerceWebOrigin,
  getPromptOptimizerOrigin,
  getPublisherWebOrigin,
  getQuickReplicaOrigin,
  getStoryWebOrigin,
  getToolWebOrigin,
} from "@/lib/app-web-origins";
import { getBookMallOrigin } from "@/lib/book-mall-origin";
import {
  buildMembershipCheckoutHref,
  buildTopupHref,
  sanitizeCheckoutReturnTo,
} from "@/lib/platform-billing/build-checkout-href";

export function checkoutAllowedReturnOrigins(): string[] {
  const origins = [
    getBookMallOrigin(),
    getToolWebOrigin(),
    getStoryWebOrigin(),
    getCanvasWebOrigin(),
    getEcommerceWebOrigin(),
    getPromptOptimizerOrigin(),
    getQuickReplicaOrigin(),
    getDirectorWebOrigin(),
    getCommonToolsOrigin(),
    getPublisherWebOrigin(),
    process.env.NEXTAUTH_URL,
    process.env.MAIN_SITE_ORIGIN,
  ];
  if (process.env.NODE_ENV === "development") {
    origins.push(
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:3003",
      "http://localhost:3004",
      "http://localhost:3007",
      "http://localhost:3008",
    );
  }
  return [...new Set(origins.filter(Boolean).map((o) => o!.replace(/\/$/, "")))];
}

export function resolveCheckoutReturnTo(raw: string | null | undefined): string | null {
  return sanitizeCheckoutReturnTo(raw, checkoutAllowedReturnOrigins());
}

export function buildBookTopupHref(input: {
  packId?: string;
  returnTo?: string | null;
}): string {
  const bookOrigin =
    getBookMallOrigin() ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return buildTopupHref({
    bookOrigin,
    packId: input.packId,
    returnTo: input.returnTo,
    allowedOrigins: checkoutAllowedReturnOrigins(),
  });
}

export function buildBookMembershipHref(input: {
  planId: string;
  seats?: number;
  returnTo?: string | null;
}): string {
  const bookOrigin =
    getBookMallOrigin() ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return buildMembershipCheckoutHref({
    bookOrigin,
    planId: input.planId,
    seats: input.seats,
    returnTo: input.returnTo,
    allowedOrigins: checkoutAllowedReturnOrigins(),
  });
}

export function checkoutSuccessRedirect(
  returnTo: string | null | undefined,
  fallback: string,
): string {
  return resolveCheckoutReturnTo(returnTo) ?? fallback;
}
