/** 已成功加载过的媒体 src（模块级缓存，跨 remount 复用） */
const LOADED_MEDIA_SRCS = new Set<string>();

export function isMediaSrcLoaded(src: string | undefined | null): boolean {
  return Boolean(src && LOADED_MEDIA_SRCS.has(src));
}

export function markMediaSrcLoaded(src: string | undefined | null): void {
  if (src) LOADED_MEDIA_SRCS.add(src);
}
