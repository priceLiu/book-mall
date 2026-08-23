import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";
import { QUICK_REPLICA_SSO_APP } from "@/lib/qr-sso-app";

export function qrLoginHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, QUICK_REPLICA_SSO_APP, redirectPath);
}

export function qrRegisterHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, QUICK_REPLICA_SSO_APP, redirectPath);
}
