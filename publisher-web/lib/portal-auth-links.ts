import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "publisher" as const;

export function publisherLoginHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, APP, redirectPath);
}

export function publisherRegisterHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, APP, redirectPath);
}
