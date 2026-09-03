import {
  buildBookPortalLoginHref,
  buildBookPortalReEnterHref,
  buildBookPortalRegisterHref,
} from "@private/federated-portal-nav";
import { getMainSiteOrigin } from "@/lib/site-origin";

const APP = "story" as const;

/** 解析主站 Origin：优先调用方传入（BookMallBaseUrlProvider），再回落 env。 */
function resolveBookOrigin(bookOrigin?: string | null): string | null {
  const raw = bookOrigin?.trim() || getMainSiteOrigin();
  if (!raw) return null;
  try {
    return new URL(raw.includes("://") ? raw : `http://${raw}`).origin;
  } catch {
    return null;
  }
}

/**
 * 打开需登录能力时的入口：走 Book re-enter。
 * 已登录 Book → 静默换票回子站；未登录 → 主站登录页（callback 回 re-enter）。
 * `bookOrigin` 请传 `useBookMallBaseUrl()`，避免客户端读不到非 NEXT_PUBLIC 变量。
 */
export function storyLoginHref(
  redirectPath = "/",
  bookOrigin?: string | null,
): string {
  const book = resolveBookOrigin(bookOrigin);
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalReEnterHref(book, APP, redirectPath);
}

/** 显式「去主站登录页」（不静默换票）。一般优先用 storyLoginHref。 */
export function storyBookLoginPageHref(
  redirectPath = "/",
  bookOrigin?: string | null,
): string {
  const book = resolveBookOrigin(bookOrigin);
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalLoginHref(book, APP, redirectPath);
}

export function storyRegisterHref(
  redirectPath = "/",
  bookOrigin?: string | null,
): string {
  const book = resolveBookOrigin(bookOrigin);
  if (!book) return "/sso-error?reason=missing_main_origin";
  return buildBookPortalRegisterHref(book, APP, redirectPath);
}
