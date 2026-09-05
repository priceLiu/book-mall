/**
 * 异步上报访问统计到 Book internal API（fire-and-forget）。
 * 副本：由 scripts/sync-platform-traffic.mjs 从 shared/platform-traffic 同步。
 */

import { resolveBookMallOrigin } from "./book-mall-origin";
import { resolveToolsTokenUserId } from "./decode-tools-token-sub";
import { pickTrafficIngestSecret } from "./traffic-ingest-secret";
import { shouldRecordTrafficHit } from "./should-record-traffic-hit";

export type FireTrafficHitInput = {
  appKey: string;
  method: string;
  pathname: string;
  search: string;
  /** 原始请求 IP 头，Book 侧二次解析 */
  forwardedFor: string | null;
  realIp: string | null;
  excludeAdmin?: boolean;
  /** Book User.id；已登录时由 middleware 传入 */
  userId?: string | null;
};

export type FireTrafficHitFromRequestOptions = {
  excludeAdmin?: boolean;
  userId?: string | null;
  cookies?: { get(name: string): { value: string } | undefined };
};

export function fireTrafficHit(input: FireTrafficHitInput): void {
  if (
    !shouldRecordTrafficHit({
      method: input.method,
      pathname: input.pathname,
      search: input.search,
      excludeAdmin: input.excludeAdmin,
    })
  ) {
    return;
  }

  const origin = resolveBookMallOrigin();
  const secret = pickTrafficIngestSecret();
  if (!origin || !secret) return;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  };
  if (input.forwardedFor) {
    headers["x-forwarded-for"] = input.forwardedFor;
  } else if (input.realIp) {
    headers["x-forwarded-for"] = input.realIp;
  }
  if (input.realIp) {
    headers["x-real-ip"] = input.realIp;
  }

  const url = `${origin}/api/internal/platform-traffic/hit`;
  const bodyObj: Record<string, string> = {
    appKey: input.appKey,
    path: `${input.pathname}${input.search || ""}`.slice(0, 512),
  };
  const userId = input.userId?.trim();
  if (userId) bodyObj.userId = userId.slice(0, 64);

  const body = JSON.stringify(bodyObj);

  void fetch(url, { method: "POST", headers, body }).catch(() => {
    /* 静默：统计失败不影响用户 */
  });
}

export function fireTrafficHitFromRequest(
  appKey: string,
  request: {
    method: string;
    nextUrl: { pathname: string; search: string };
    headers: Headers;
    cookies?: { get(name: string): { value: string } | undefined };
  },
  opts?: FireTrafficHitFromRequestOptions,
): void {
  const xf = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const cookieJar = opts?.cookies ?? request.cookies;
  const userId =
    opts?.userId?.trim() ||
    (cookieJar ? resolveToolsTokenUserId(cookieJar) : null) ||
    null;

  fireTrafficHit({
    appKey,
    method: request.method,
    pathname: request.nextUrl.pathname,
    search: request.nextUrl.search,
    forwardedFor: xf,
    realIp: real,
    excludeAdmin: opts?.excludeAdmin,
    userId,
  });
}
