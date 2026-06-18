import {
  buildAppWebUrl,
  getCanvasWebOrigin,
  getEcommerceWebOrigin,
  getPromptOptimizerOrigin,
  getStoryWebOrigin,
} from "@/lib/app-web-origins";
import { getBookMallOrigin } from "@/lib/gateway/env";
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

/** book-mall 逐步 federated logout（`/api/auth/federated-logout?step=&final=`）。 */
export function buildFederatedLogoutStepUrl(
  step: number,
  finalCallbackUrl: string,
  bookOrigin: string,
): string {
  const base = bookOrigin.replace(/\/$/, "");
  const url = new URL("/api/auth/federated-logout", base);
  url.searchParams.set("step", String(step));
  url.searchParams.set("final", finalCallbackUrl);
  return url.toString();
}

/**
 * full-signout 清 Cookie 后用的 **同源相对** 入口（须与大量 Set-Cookie 同响应，不可再 302 到外站）。
 * CloudBase：Set-Cookie × 外链 Location 同包会 502；子站链路由 `/api/auth/federated-logout` 继续。
 */
export function buildFederatedLogoutRelativeEntry(
  callbackPath: string,
): string | null {
  if (!shouldUseFederatedToolsLogoutChain()) return null;
  if (listFederatedToolsLogoutOrigins().length === 0) return null;
  const path =
    callbackPath.startsWith("/") && !callbackPath.startsWith("//")
      ? callbackPath
      : "/";
  return `/api/auth/federated-logout?step=0&final=${encodeURIComponent(path)}`;
}
