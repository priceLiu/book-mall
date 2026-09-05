import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "prompt-optimizer" as const;

function sanitizeRedirectPath(raw: string, fallback = "/"): string {
  const path = raw?.trim() || fallback;
  if (!path.startsWith("/") || path.startsWith("//")) return fallback;
  return path;
}

function reEnterQuery(redirectPath: string): string {
  const redirect = sanitizeRedirectPath(redirectPath);
  return new URLSearchParams({ app: APP, redirect }).toString();
}

function bookLoginHref(redirectPath = "/"): string | null {
  const book = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!book) return null;
  const callbackUrl = `/api/sso/tools/re-enter?${reEnterQuery(redirectPath)}`;
  return `${book}/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

function bookRegisterHref(redirectPath = "/"): string | null {
  const book = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!book) return null;
  const callbackUrl = `/api/sso/tools/re-enter?${reEnterQuery(redirectPath)}`;
  return `${book}/register?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

export function bookMallReEnterHref(
  redirectPath: string,
  _app: typeof APP = APP,
): string | null {
  const book = getMainSiteOrigin()?.replace(/\/$/, "");
  if (!book) return null;
  return `${book}/api/sso/tools/re-enter?${reEnterQuery(redirectPath)}`;
}

export function bookMallLoginHref(redirectPath: string): string | null {
  return bookLoginHref(redirectPath);
}

export function promptOptimizerLoginHref(returnPath = "/"): string {
  return bookLoginHref(returnPath) ?? "/sso-error?reason=missing_main_origin";
}

export function promptOptimizerRegisterHref(returnPath = "/"): string {
  return bookRegisterHref(returnPath) ?? "/sso-error?reason=missing_main_origin";
}
