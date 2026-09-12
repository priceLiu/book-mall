/** 导出合成：OSS 公网 URL → 同域代理，避免 canvas CORS 无法读像素 */
export function imageLayerComposeImageSrc(ossUrl: string): string {
  const trimmed = ossUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("/api/book-mall/")) return trimmed;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return trimmed;
  return `/api/book-mall/api/sso/tools/ecom/hand-craft/proxy-image?url=${encodeURIComponent(trimmed)}`;
}
