/** 画布 OSS 路径是否归属指定项目（node-image / node-video 前缀） */
export function canvasOssUrlBelongsToProject(
  url: string,
  projectId: string,
): boolean {
  const pid = projectId.trim();
  if (!pid) return true;
  const u = url.trim();
  if (!u.startsWith("http")) return false;
  return (
    u.includes(`/node-image/${pid}/`) ||
    u.includes(`/node-image/${pid}?`) ||
    u.includes(`/node-video/${pid}/`) ||
    u.includes(`/node-video/${pid}?`) ||
    u.endsWith(`/node-image/${pid}`) ||
    u.endsWith(`/node-video/${pid}`)
  );
}

/** 列表/封面：stored 指向别的项目时视为不可信 */
export function isCanvasThumbnailUrlForProject(
  url: string,
  projectId: string,
): boolean {
  const u = url.trim();
  if (!u.startsWith("http")) return false;
  if (!/\/node-(image|video)\/[a-z0-9]{20,}/i.test(u)) return true;
  return canvasOssUrlBelongsToProject(u, projectId);
}
