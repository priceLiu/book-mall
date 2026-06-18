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
 * 从第一个子站 `/api/tools-logout?next=…` 起，串联清除各站 `tools_token`。
 * 采用 book-mall 分步跳转，避免把所有 next 嵌套进一条 Location（CloudBase 网关会 502）。
 */
export function buildFederatedToolsLogoutStartUrl(finalCallbackUrl: string): string {
  if (!shouldUseFederatedToolsLogoutChain()) return finalCallbackUrl;

  const origins = listFederatedToolsLogoutOrigins();
  if (origins.length === 0) return finalCallbackUrl;

  const book = trimOrigin(getBookMallOrigin());
  if (!book) return finalCallbackUrl;

  const step1 = buildFederatedLogoutStepUrl(1, finalCallbackUrl, book);
  const first = new URL("/api/tools-logout", origins[0]!);
  first.searchParams.set("next", step1);
  return first.toString();
}
