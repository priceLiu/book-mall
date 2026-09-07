import {
  buildBookPortalLoginHref,
  buildBookPortalReEnterHref,
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

/** 主站已登录时静默换票；未登录则主站会跳转登录页（非注册页）。 */
export function qrReEnterHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalReEnterHref(book, QUICK_REPLICA_SSO_APP, redirectPath);
}
