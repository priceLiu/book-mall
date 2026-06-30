import { getMainSiteOrigin } from "@/lib/site-origin";
import { QUICK_REPLICA_SSO_APP } from "@/lib/qr-sso-app";
import {
  bumpSsoReenterAttempts,
  MAX_SSO_REENTER_ATTEMPTS,
  readSsoReenterAttempts,
} from "@/lib/sso-reenter-attempts";
import { buildSilentReEnterHref } from "@/lib/tools-silent-sso";
import { isSsoReenterSuppressedClient } from "@/lib/tools-logout-next-url";

let reenterInFlight = false;

/** 平台 API 返回 401 未登录时，静默 re-enter（最多 6 次）。 */
export function triggerQrSilentReEnter(): boolean {
  if (typeof window === "undefined") return false;
  if (isSsoReenterSuppressedClient()) return false;
  if (reenterInFlight) return true;
  if (readSsoReenterAttempts() >= MAX_SSO_REENTER_ATTEMPTS) return false;

  const mainOrigin = getMainSiteOrigin();
  const path = window.location.pathname + window.location.search;
  const href = buildSilentReEnterHref(mainOrigin, path, QUICK_REPLICA_SSO_APP);
  if (!href) return false;

  reenterInFlight = true;
  bumpSsoReenterAttempts();
  window.location.href = href;
  return true;
}

async function isPlatformUnauthorized(res: Response): Promise<boolean> {
  if (res.status !== 401) return false;
  try {
    const data = (await res.clone().json()) as { error?: string };
    const err = data.error?.trim();
    return err === "未登录" || err === "no_session" || err === "Unauthorized";
  } catch {
    return true;
  }
}

/** 调用 book-mall BFF；401 时自动静默换票重连。 */
export async function fetchQrPlatform(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const res = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    cache: init?.cache ?? "no-store",
  });
  if (await isPlatformUnauthorized(res)) {
    triggerQrSilentReEnter();
  }
  return res;
}
