function brandViProxyImageSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/book-mall/")) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  return `/api/book-mall/api/sso/tools/ecom/brand-vi/proxy-image?url=${encodeURIComponent(trimmed)}`;
}

/** 拼版 export 模式：OSS 公网 URL → 同域代理，供 html2canvas 无 CORS 抓图 */
export function brandViComposeImageSrc(ossUrl: string): string {
  return brandViProxyImageSrc(ossUrl);
}

export function brandViSlotImageSrc(imageUrl: string): string {
  const trimmed = imageUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/book-mall/") || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (/\.aliyuncs\.com/i.test(trimmed)) return trimmed;
  return brandViProxyImageSrc(trimmed);
}
