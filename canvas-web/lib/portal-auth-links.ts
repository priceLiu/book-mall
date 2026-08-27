import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "canvas" as const;

function resolveBookPortalOrigin(bookOrigin?: string | null): string | null {
  const explicit = bookOrigin?.trim();
  if (explicit) return explicit;
  return getMainSiteOrigin();
}

export function canvasLoginHref(
  redirectPath = "/projects",
  bookOrigin?: string | null,
): string {
  const book = resolveBookPortalOrigin(bookOrigin);
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, APP, redirectPath);
}

export function canvasRegisterHref(
  redirectPath = "/projects",
  bookOrigin?: string | null,
): string {
  const book = resolveBookPortalOrigin(bookOrigin);
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, APP, redirectPath);
}
