import {
  bookMallReEnterHref,
} from "@/lib/platform-sso-links";
import { QUICK_REPLICA_SSO_APP } from "@/lib/qr-sso-app";

let clientRefreshInflight: Promise<boolean> | null = null;

async function tryClientSessionRefresh(): Promise<boolean> {
  if (clientRefreshInflight) return clientRefreshInflight;
  clientRefreshInflight = fetch("/api/tools-session/refresh", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (r) => {
      if (!r.ok) return false;
      const data = (await r.json().catch(() => null)) as { active?: boolean } | null;
      return Boolean(data?.active);
    })
    .catch(() => false)
    .finally(() => {
      clientRefreshInflight = null;
    });
  return clientRefreshInflight;
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

/** 用户主动重新连接主站（保存失败等场景，不自动整页跳转）。 */
export function openQrSessionReconnect(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname + window.location.search;
  const href = bookMallReEnterHref(path, QUICK_REPLICA_SSO_APP);
  if (href) window.location.href = href;
}

/** 调用 book-mall BFF；401 时先静默 refresh 并重试，仍失败则返回 401（不自动跳转）。 */
export async function fetchQrPlatform(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const doFetch = () =>
    fetch(input, {
      ...init,
      credentials: init?.credentials ?? "same-origin",
      cache: init?.cache ?? "no-store",
    });

  let res = await doFetch();
  if (await isPlatformUnauthorized(res)) {
    const refreshed = await tryClientSessionRefresh();
    if (refreshed) {
      res = await doFetch();
    }
  }
  return res;
}

export function formatQrPlatformError(error: string | undefined): string {
  const e = error?.trim() ?? "";
  if (e === "未登录" || e === "no_session" || e === "Unauthorized") {
    return "会话已过期，请点击「重新连接」后继续操作";
  }
  return e || "操作失败";
}

export function isQrAuthError(error: string | undefined): boolean {
  const e = error?.trim() ?? "";
  return e === "未登录" || e === "no_session" || e === "Unauthorized";
}
