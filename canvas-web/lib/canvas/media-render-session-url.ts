import { resolveBookMallBrowserRequest } from "@/lib/book-mall-client-request";

/** 剪辑任务 · BFF 本地下载 URL（会话预览，勿与 OSS 混用） */
export function resolveMediaRenderLocalDownloadUrl(
  base: string,
  job: { localDownloadPath?: string | null; id: string },
): string | null {
  if (!job.localDownloadPath?.trim()) return null;
  const { url } = resolveBookMallBrowserRequest(base, job.localDownloadPath, {
    method: "GET",
  });
  return url;
}

/** 是否为本会话写入的 BFF 本地成片 URL（OSS 上传完成后仍应保持播放不换源） */
export function isMediaRenderSessionLocalUrl(
  url: string | null | undefined,
  jobId?: string | null,
): boolean {
  const u = url?.trim();
  if (!u) return false;
  if (jobId && u.includes(`/media/render/${encodeURIComponent(jobId)}/download`)) {
    return true;
  }
  return /\/api\/canvas\/media\/render\/[^/?#]+\/download(?:[/?#]|$)/.test(u);
}
