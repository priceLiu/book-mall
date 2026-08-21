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
