/** 画布视频编辑 · Platform API 客户端（经 BFF） */

export type VideoFilmstripFrame = {
  atSec: number;
  thumbnailUrl: string;
};

export function formatLibtvVideoEditClientError(
  raw: string | undefined,
  status?: number,
): string {
  const t = (raw ?? "").trim();
  if (
    t === "book_mall_proxy_failed" ||
    t.includes("book_mall_proxy_failed") ||
    status === 502
  ) {
    return "主站处理超时或连接中断，请稍后重试";
  }
  if (
    /socket disconnected|secure TLS|aliyuncs\.com|GET https:\/\//i.test(t)
  ) {
    return "成片读取或写入云存储失败，请稍后重试";
  }
  return t || "处理失败";
}

export async function fetchVideoFilmstrip(opts: {
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
      frameCount: opts.frameCount,
    }),
    signal: AbortSignal.timeout(180_000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    durationSec?: number;
    frames?: VideoFilmstripFrame[];
  };
  if (!res.ok) {
    throw new Error(
      formatLibtvVideoEditClientError(data.message ?? data.error, res.status),
    );
  }
  const frames = Array.isArray(data.frames) ? data.frames : [];
  if (!frames.length) throw new Error("未获得时间轴缩略图");
  return {
    durationSec: Number(data.durationSec) || frames[frames.length - 1]?.atSec || 1,
    frames,
  };
}

export async function postVideoFrameExtract(opts: {
  sourceVideoUrl: string;
  projectId?: string | null;
  mode: "first" | "last" | "at";
  atSec?: number;
}): Promise<{ imageUrl: string; capturedAtSec: number }> {
  const res = await fetch("/api/book-mall/api/platform/v1/video-frame-extract", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourceVideoUrl: opts.sourceVideoUrl,
      projectId: opts.projectId ?? undefined,
      mode: opts.mode,
      atSec: opts.atSec,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    imageUrl?: string;
    capturedAtSec?: number;
  };
  if (!res.ok) {
    throw new Error(
      formatLibtvVideoEditClientError(data.message ?? data.error, res.status),
    );
  }
  const imageUrl = data.imageUrl?.trim();
  if (!imageUrl) throw new Error("未获得截帧图片");
  return {
    imageUrl,
    capturedAtSec: Number(data.capturedAtSec) || 0,
  };
}

export async function postVideoSubtitleExtract(opts: {
  sourceVideoUrl: string;
  projectId?: string | null;
}): Promise<{
  srt: string;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  noSpeech?: boolean;
}> {
  const res = await fetch(
    "/api/book-mall/api/platform/v1/video-subtitle-extract",
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceVideoUrl: opts.sourceVideoUrl,
        projectId: opts.projectId ?? undefined,
      }),
    },
  );
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    srt?: string;
    segments?: Array<{ startMs: number; endMs: number; text: string }>;
    noSpeech?: boolean;
  };
  if (!res.ok) {
    throw new Error(
      formatLibtvVideoEditClientError(data.message ?? data.error, res.status),
    );
  }
  return {
    srt: typeof data.srt === "string" ? data.srt : "",
    segments: Array.isArray(data.segments) ? data.segments : [],
    noSpeech: data.noSpeech,
  };
}

export async function postVideoTrim(opts: {
  sourceVideoUrl: string;
  projectId?: string | null;
  startSec: number;
  endSec: number;
}): Promise<{
  videoUrl: string;
  posterUrl?: string;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
}> {
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
    startSec?: number;
    endSec?: number;
    durationSec?: number;
  };
  if (!res.ok) {
    throw new Error(
      formatLibtvVideoEditClientError(data.message ?? data.error, res.status),
    );
  }
  const videoUrl = data.videoUrl?.trim();
  if (!videoUrl) throw new Error("未获得裁剪视频");
  return {
    videoUrl,
    posterUrl: data.posterUrl?.trim() || undefined,
    startSec: Number.isFinite(Number(data.startSec))
      ? Number(data.startSec)
      : undefined,
    endSec: Number.isFinite(Number(data.endSec))
      ? Number(data.endSec)
      : undefined,
    durationSec: Number.isFinite(Number(data.durationSec))
      ? Number(data.durationSec)
      : undefined,
  };
}

function normalizeLibtvVideoEditHttpsUrl(
  raw: string | undefined,
): string | undefined {
  const url = raw?.trim() || "";
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) {
    return undefined;
  }
  return url;
}

/** 源节点是否已有可处理的 OSS/HTTPS 成片（含节点 ossUrl 与任务成片回退） */
export function resolveLibtvVideoEditSourceUrl(data: {
  ossUrl?: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string };
  fallbackTaskMediaUrl?: string;
}): string | undefined {
  return (
    normalizeLibtvVideoEditHttpsUrl(data.runtime?.ossUrl) ??
    normalizeLibtvVideoEditHttpsUrl(data.runtime?.ephemeralUrl) ??
    normalizeLibtvVideoEditHttpsUrl(data.ossUrl) ??
    normalizeLibtvVideoEditHttpsUrl(data.fallbackTaskMediaUrl)
  );
}

/** @deprecated 使用 resolveLibtvVideoEditSourceUrl */
export function libtvVideoEditSourceReady(data: {
  ossUrl?: string;
  runtime?: { ossUrl?: string; ephemeralUrl?: string };
  fallbackTaskMediaUrl?: string;
}): string | undefined {
  return resolveLibtvVideoEditSourceUrl(data);
}
