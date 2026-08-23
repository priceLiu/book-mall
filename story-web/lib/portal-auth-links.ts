import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "story" as const;

export function storyLoginHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, APP, redirectPath);
}

export function storyRegisterHref(redirectPath = "/"): string {
  const book = getMainSiteOrigin();
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, APP, redirectPath);
}
