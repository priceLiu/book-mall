/** 画廊封面预加载结果缓存（同一会话内避免重复请求） */
const posterLoaded = new Set<string>();

export function isQrMasonryPosterCached(templateId: string): boolean {
  return posterLoaded.has(templateId);
}

export function markQrMasonryPosterCached(templateId: string): void {
  posterLoaded.add(templateId);
}
