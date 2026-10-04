/** 电商 · 视频裁剪/缩略图（Platform API 经 book-mall BFF，与画布 libtv-video-edit-client 对齐） */

export type VideoFilmstripFrame = {
  atSec: number;
  thumbnailUrl: string;
};

function formatError(raw: string | undefined, status?: number): string {
  const t = (raw ?? "").trim();
  if (t === "book_mall_proxy_failed" || status === 502) {
    return "主站处理超时或连接中断，请稍后重试";
  }
  return t || "处理失败";
}

export async function fetchEcomVideoFilmstrip(opts: {
  sourceVideoUrl: string;
  projectId?: string | null;
  frameCount?: number;
}): Promise<{ durationSec: number; frames: VideoFilmstripFrame[] }> {
  const res = await fetch("/api/book-mall/api/platform/v1/video-filmstrip", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceVideoUrl: opts.sourceVideoUrl,
      projectId: opts.projectId ?? undefined,
      frameCount: opts.frameCount ?? 24,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    durationSec?: number;
    frames?: VideoFilmstripFrame[];
  };
  if (!res.ok) {
    throw new Error(formatError(data.message ?? data.error, res.status));
  }
  const frames = Array.isArray(data.frames) ? data.frames : [];
  if (!frames.length) throw new Error("未获得时间轴缩略图");
  return {
    durationSec: Number(data.durationSec) || frames[frames.length - 1]?.atSec || 1,
    frames,
  };
}

export async function postEcomVideoTrim(opts: {
  sourceVideoUrl: string;
  projectId?: string | null;
  startSec: number;
  endSec: number;
}): Promise<{ videoUrl: string; posterUrl?: string }> {
  const res = await fetch("/api/book-mall/api/platform/v1/video-trim", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceVideoUrl: opts.sourceVideoUrl,
      projectId: opts.projectId ?? undefined,
      startSec: opts.startSec,
      endSec: opts.endSec,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    videoUrl?: string;
    posterUrl?: string;
  };
  if (!res.ok) {
    throw new Error(formatError(data.message ?? data.error, res.status));
  }
  const videoUrl = data.videoUrl?.trim();
  if (!videoUrl) throw new Error("裁剪未返回视频地址");
  return { videoUrl, posterUrl: data.posterUrl?.trim() };
}
