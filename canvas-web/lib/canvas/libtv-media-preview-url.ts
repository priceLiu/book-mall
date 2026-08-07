/** LibTV 媒体节点 · 预览 URL（粘贴/上传：本地 blob 优先；生成中：ephemeral 优先于未就绪 OSS） */

import { isCanvasManagedOssUrl } from "./canvas-managed-oss-url";

export function resolveLibtvMediaPreviewUrl(data: {
  ossUrl?: string;
  blobUrl?: string;
  ephemeralUrl?: string;
  uploading?: boolean;
  /** OSS 加载失败时强制回退 blob */
  preferBlob?: boolean;
  /** OSS 加载失败时回退 ephemeral（生成结果厂商 URL） */
  preferEphemeral?: boolean;
}): string {
  const blob = String(data.blobUrl ?? "").trim();
  const oss = String(data.ossUrl ?? "").trim();
  const ephemeral = String(data.ephemeralUrl ?? "").trim();
  const ossHttp = oss && /^https?:\/\//i.test(oss) ? oss : "";
  const ephemeralHttp =
    ephemeral && /^https?:\/\//i.test(ephemeral) ? ephemeral : "";
  if (data.preferBlob && blob) return blob;
  if (data.preferEphemeral && ephemeralHttp) return ephemeralHttp;
  if (ossHttp && !data.preferBlob && isCanvasManagedOssUrl(ossHttp)) {
    return ossHttp;
  }
  if (ephemeralHttp && !data.preferBlob) return ephemeralHttp;
  if (data.uploading && blob) return blob;
  if (ossHttp) return ossHttp;
  if (oss.startsWith("blob:")) return oss;
  return blob || ephemeralHttp || oss;
}

export function libtvMediaPreviewCanFallbackToBlob(data: {
  ossUrl?: string;
  blobUrl?: string;
  ephemeralUrl?: string;
}): boolean {
  const blob = String(data.blobUrl ?? "").trim();
  const oss = String(data.ossUrl ?? "").trim();
  return Boolean(blob && oss && blob !== oss);
}

export function libtvMediaPreviewCanFallbackToEphemeral(data: {
  ossUrl?: string;
  ephemeralUrl?: string;
}): boolean {
  const ephemeral = String(data.ephemeralUrl ?? "").trim();
  const oss = String(data.ossUrl ?? "").trim();
  return Boolean(
    ephemeral &&
      /^https?:\/\//i.test(ephemeral) &&
      oss &&
      ephemeral !== oss,
  );
}
