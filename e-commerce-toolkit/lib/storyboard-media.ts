/** 判断 URL 是否为图片（用于排除误当成片） */
export function isStoryboardImageUrl(url: string | null | undefined): boolean {
  const u = url?.trim() ?? "";
  if (!u) return false;
  return /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(u) || u.includes("image/png");
}

/** 判断 URL 是否为视频资产（OSS 视频常无 .mp4 后缀） */
export function isStoryboardVideoUrl(url: string | null | undefined): boolean {
  const u = url?.trim() ?? "";
  if (!/^https?:\/\//.test(u)) return false;
  if (isStoryboardImageUrl(u)) return false;
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(u)) return true;
  // 画布用户 OSS 视频：路径含 /canvas/user/ 且非图片扩展名
  if (/\/canvas\/user\//i.test(u)) return true;
  return false;
}
