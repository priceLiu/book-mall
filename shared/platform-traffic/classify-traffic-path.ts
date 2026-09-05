/**
 * 扫描/漏洞探测路径判定（各子应用与 Book 汇聚共用）。
 * 命中仍计入 PV，仅打标，不丢弃。
 * 副本：由 scripts/sync-platform-traffic.mjs 从 shared/platform-traffic 同步。
 */

const PROBE_EXT =
  /\.(php\d*|phtml|asp|aspx|jspx?|cgi|env|sql|bak|git|py|rb|exe|dll|cfm|pl)$/i;

const PROBE_SNIPPETS = [
  "/wp-admin",
  "/wp-login",
  "/wp-content",
  "/wp-includes",
  "/wordpress",
  "phpmyadmin",
  "xmlrpc",
  "/cgi-bin",
  "/.git",
  "/.env",
  "/.aws",
  "/.svn",
  "/vendor/phpunit",
  "/actuator",
  "/manager/html",
  "/solr/",
  "/hudson",
  "/jenkins",
  "/owa/",
  "/autodiscover",
  "/_ignition",
  "/eval-stdin",
  "/setup.php",
];

/** 路径是否像自动化扫描（WordPress / .env / phpmyadmin 等），而非正常产品页。 */
export function isProbeTrafficPath(rawPath: string): boolean {
  const pathname = (rawPath.split("?")[0] ?? rawPath).trim().toLowerCase();
  if (!pathname || pathname === "/") return false;
  if (PROBE_EXT.test(pathname)) return true;
  return PROBE_SNIPPETS.some((s) => pathname.includes(s));
}

export type TrafficHitKind = "page" | "probe" | "mixed";

/** IP 日明细：全部为扫描 / 部分扫描 / 正常页面。 */
export function trafficHitKind(hitCount: number, probeHitCount: number): TrafficHitKind {
  if (probeHitCount <= 0) return "page";
  if (probeHitCount >= hitCount) return "probe";
  return "mixed";
}
