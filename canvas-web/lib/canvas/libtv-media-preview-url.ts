/** LibTV 媒体节点 · 预览 URL（粘贴/上传：本地 blob 优先，OSS 就绪后再切换） */

export function resolveLibtvMediaPreviewUrl(data: {
  ossUrl?: string;
  blobUrl?: string;
  uploading?: boolean;
  /** OSS 加载失败时强制回退 blob */
  preferBlob?: boolean;
}): string {
  const blob = String(data.blobUrl ?? "").trim();
  const oss = String(data.ossUrl ?? "").trim();
  if (data.preferBlob && blob) return blob;
  if (data.uploading && blob) return blob;
  if (oss && /^https?:\/\//i.test(oss)) return oss;
  if (oss.startsWith("blob:")) return oss;
  return blob || oss;
}

export function libtvMediaPreviewCanFallbackToBlob(data: {
  ossUrl?: string;
  blobUrl?: string;
}): boolean {
  const blob = String(data.blobUrl ?? "").trim();
  const oss = String(data.ossUrl ?? "").trim();
  return Boolean(blob && oss && blob !== oss);
}
