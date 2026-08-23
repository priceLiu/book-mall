import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "canvas" as const;

export function canvasLoginHref(redirectPath = "/projects"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, APP, redirectPath);
}

export function canvasRegisterHref(redirectPath = "/projects"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, APP, redirectPath);
}
