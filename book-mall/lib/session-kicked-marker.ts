/** sessionStorage：标记本标签页曾成功登录，用于区分「主动退出」与「被新登录挤下线」。 */

import {
  clearSsoReenterSuppress,
  markSsoReenterSuppressed,
} from "@/lib/sso-reenter-suppress-cookie";

export const BOOK_MALL_SESSION_MARKER_KEY = "book_mall_session_active";

export function markBookMallSessionActive(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(BOOK_MALL_SESSION_MARKER_KEY, "1");
  clearSsoReenterSuppress();
}

export function clearBookMallSessionMarker(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(BOOK_MALL_SESSION_MARKER_KEY);
}

export function hadBookMallSessionMarker(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(BOOK_MALL_SESSION_MARKER_KEY) === "1";
}

export function bookMallFullSignOutHref(callbackUrl = "/"): string {
  return `/api/auth/full-signout?callbackUrl=${encodeURIComponent(callbackUrl)}`;
}

/** 主动退出：先清 marker + 禁止子站静默换票，避免 canvas 等立刻 re-enter。 */
export function navigateBookMallFullSignOut(callbackUrl = "/"): void {
  clearBookMallSessionMarker();
  markSsoReenterSuppressed();
  window.location.href = bookMallFullSignOutHref(callbackUrl);
}

export const SESSION_KICKED_MESSAGE =
  "您的账号已在其他设备或浏览器登录，当前会话已退出。请重新登录后继续使用。";
