/** 画布持久化媒体 · 仅 our OSS 写入 data.ossUrl（厂商 ephemeral 走 runtime） */

export function isCanvasManagedOssUrl(url: string | null | undefined): boolean {
  const u = String(url ?? "").trim();
  if (!u || !/^https?:\/\//i.test(u)) return false;
  return /\.aliyuncs\.com\//i.test(u) || u.includes("/canvas/");
}
