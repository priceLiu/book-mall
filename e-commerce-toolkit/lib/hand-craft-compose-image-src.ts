/** 拼版 export 模式：OSS 公网 URL → 同域代理，供 html2canvas 无 CORS 抓图 */
export function handCraftComposeImageSrc(ossUrl: string): string {
  const trimmed = ossUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/book-mall/")) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  return `/api/book-mall/api/sso/tools/ecom/hand-craft/proxy-image?url=${encodeURIComponent(trimmed)}`;
}
