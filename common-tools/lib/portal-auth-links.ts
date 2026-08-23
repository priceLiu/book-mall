import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "common-tools" as const;

export function buildLoginUrl(returnPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, APP, returnPath);
}

export function buildRegisterUrl(returnPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, APP, returnPath);
}
