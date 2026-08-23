import {
  buildBookPortalLoginHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getBookOriginClient } from "@/lib/ecom-auth";

const APP = "e-commerce" as const;

export function buildEcomLoginUrl(returnPath = "/"): string {
  return buildBookPortalLoginHref(getBookOriginClient(), APP, returnPath);
}

export function buildEcomRegisterUrl(returnPath = "/"): string {
  return buildBookPortalRegisterHref(getBookOriginClient(), APP, returnPath);
}
