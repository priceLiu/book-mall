import {
  buildAppWebUrl,
  getCanvasWebOrigin,
  getEcommerceWebOrigin,
  getPromptOptimizerOrigin,
  getStoryWebOrigin,
} from "@/lib/app-web-origins";
import { getBookMallOrigin } from "@/lib/gateway/env";
import { listPlatformWebOrigins } from "@/lib/platform-web-origins";
import { getToolsPublicOrigin } from "@/lib/sso-tools-env";

function trimOrigin(raw: string | null | undefined): string | null {
  const v = raw?.trim().replace(/\/$/, "");
  return v && v.startsWith("http") ? v : null;
}

/** 生产或多域环境须逐站清 Cookie；本地 localhost 共享 host，可跳过链。 */
export function shouldUseFederatedToolsLogoutChain(): boolean {
  if (process.env.FEDERATED_TOOLS_LOGOUT === "1") return true;
  if (process.env.FEDERATED_TOOLS_LOGOUT === "0") return false;
  return process.env.NODE_ENV === "production";
}

/** 退出时须逐站清除 `tools_token` 的子应用 Origin（去重、稳定顺序）。 */
export function listFederatedToolsLogoutOrigins(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const candidates = [
    getToolsPublicOrigin(),
    getCanvasWebOrigin(),
    getStoryWebOrigin(),
    getPromptOptimizerOrigin(),
    getEcommerceWebOrigin(),
  ];
  for (const raw of candidates) {
    const o = trimOrigin(raw);
    if (!o || seen.has(o)) continue;
    seen.add(o);
    out.push(o);
  }
  return out;
}

/**
 * 将相对 callback 解析为绝对 URL（跨域 federated logout 链需要）。
 */
export function resolveBookMallCallbackUrl(
  callbackPath: string,
  requestOrigin?: string,
): string {
  const path =
    callbackPath.startsWith("/") && !callbackPath.startsWith("//")
      ? callbackPath
      : "/";
  const book = trimOrigin(getBookMallOrigin()) ?? trimOrigin(requestOrigin);
  if (book) return buildAppWebUrl(book, path);
  return path;
}

/**
 * 从第一个子站 `/api/tools-logout?next=…` 起，串联清除各站 `tools_token`，
 * 最后一跳回到 `finalCallbackUrl`（通常为 Book 首页或登录页）。
 */
export function buildFederatedToolsLogoutStartUrl(finalCallbackUrl: string): string {
  if (!shouldUseFederatedToolsLogoutChain()) return finalCallbackUrl;

  const origins = listFederatedToolsLogoutOrigins();
  if (origins.length === 0) return finalCallbackUrl;

  let next = finalCallbackUrl;
  for (let i = origins.length - 1; i >= 0; i--) {
    const logout = new URL("/api/tools-logout", origins[i]!);
    logout.searchParams.set("next", next);
    next = logout.toString();
  }
  return next;
}

export { listPlatformWebOrigins };
