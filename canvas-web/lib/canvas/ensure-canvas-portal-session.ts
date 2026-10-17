"use client";

import { fetchCanvasToolsSessionLite } from "@/lib/canvas-tools-session-fetch";
import { isCanvasToolsSessionUnauthorized } from "@/lib/canvas-tools-session-client";
import { canvasLoginHref } from "@/lib/portal-auth-links";

/** 未登录则跳转 Book 登录并返回 false */
export async function ensureCanvasPortalSessionOrLogin(
  bookOrigin: string | null,
  redirectPath: string,
  opts?: { beforeLoginRedirect?: () => void },
): Promise<boolean> {
  const session = await fetchCanvasToolsSessionLite();
  if (session.active) return true;
  if (typeof window === "undefined") return false;
  opts?.beforeLoginRedirect?.();
  window.location.href = canvasLoginHref(redirectPath, bookOrigin);
  return false;
}

export function isUnauthorizedCanvasPortalError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return isCanvasToolsSessionUnauthorized(msg);
}
