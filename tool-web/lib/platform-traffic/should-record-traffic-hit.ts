/** @generated — 勿在此编辑；改 shared/platform-traffic 后运行 node scripts/sync-platform-traffic.mjs */

/**
 * 是否应对该请求记录访问统计（各子应用 middleware 共用）。
 * 副本：由 scripts/sync-platform-traffic.mjs 从 shared/platform-traffic 同步。
 */

export type ShouldRecordTrafficHitInput = {
  method: string;
  pathname: string;
  search: string;
  /** book 侧排除 /admin；其它应用可省略 */
  excludeAdmin?: boolean;
};

/** Next.js Link 预取 / 浏览器 prefetch，不计入 PV（避免一次悬停多次 +1） */
export function isTrafficPrefetchRequest(headers: Headers): boolean {
  if (headers.get("next-router-prefetch") === "1") return true;
  if (headers.get("x-middleware-prefetch") === "1") return true;
  const purpose = (headers.get("purpose") ?? headers.get("sec-purpose") ?? "").toLowerCase();
  if (purpose.includes("prefetch")) return true;
  return false;
}

export function shouldRecordTrafficHit(input: ShouldRecordTrafficHitInput): boolean {
  const method = input.method.toUpperCase();
  if (method !== "GET" && method !== "HEAD") return false;

  const path = input.pathname;
  if (path.startsWith("/api/")) return false;
  if (path.startsWith("/_next/")) return false;
  if (input.excludeAdmin && (path === "/admin" || path.startsWith("/admin/"))) {
    return false;
  }

  if (input.search.includes("_rsc=")) return false;

  if (/\.(ico|png|jpg|jpeg|gif|svg|webp|woff2?)$/i.test(path)) return false;

  return true;
}
