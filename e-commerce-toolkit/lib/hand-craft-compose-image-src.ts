function handCraftProxyImageSrc(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/book-mall/")) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  return `/api/book-mall/api/sso/tools/ecom/hand-craft/proxy-image?url=${encodeURIComponent(trimmed)}`;
}

/** 拼版 export 模式：OSS 公网 URL → 同域代理，供 html2canvas 无 CORS 抓图 */
export function handCraftComposeImageSrc(ossUrl: string): string {
  return handCraftProxyImageSrc(ossUrl);
}

/** 槽位展示：OSS 直链；KIE nano-banana 等厂商临时 URL 走同域代理 */
export function handCraftSlotImageSrc(imageUrl: string): string {
  const trimmed = imageUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/book-mall/") || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  if (/\.aliyuncs\.com/i.test(trimmed)) return trimmed;
  return handCraftProxyImageSrc(trimmed);
}
