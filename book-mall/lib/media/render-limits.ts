import type { MediaTimelineV1 } from "@/lib/media/timeline-types";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const MEDIA_RENDER_MAX_CLIPS = envInt("MEDIA_RENDER_MAX_CLIPS", 30);
export const MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC = envInt(
  "MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC",
  600,
);
export const MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP = envInt(
  "MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP",
  200 * 1024 * 1024,
);
export const MEDIA_RENDER_MAX_CONCURRENT_PER_USER = envInt(
  "MEDIA_RENDER_MAX_CONCURRENT_PER_USER",
  2,
);
/** 长时间停留在 PENDING（未真正开剪）则回收，默认 2 分钟 */
export const MEDIA_RENDER_STALE_PENDING_SEC = envInt(
  "MEDIA_RENDER_STALE_PENDING_SEC",
  120,
);
/** 上传阶段长时间无进展则回收，默认 10 分钟 */
export const MEDIA_RENDER_UPLOAD_STALE_SEC = envInt(
  "MEDIA_RENDER_UPLOAD_STALE_SEC",
  600,
);
/** 单次 OSS 上传最长等待（multipart 卡住时强制失败并重试） */
export const MEDIA_RENDER_UPLOAD_ATTEMPT_TIMEOUT_SEC = envInt(
  "MEDIA_RENDER_UPLOAD_ATTEMPT_TIMEOUT_SEC",
  180,
);
export const MEDIA_RENDER_JOB_TIMEOUT_SEC = envInt(
  "MEDIA_RENDER_JOB_TIMEOUT_SEC",
  900,
);
export const MEDIA_RENDER_EPHEMERAL_RETENTION_DAYS = envInt(
  "MEDIA_RENDER_EPHEMERAL_RETENTION_DAYS",
  7,
);

export type RenderLimitViolation = {
  code: string;
  message: string;
};

export function validateTimelineLimits(
  timeline: MediaTimelineV1,
): RenderLimitViolation | null {
  if (timeline.clips.length < 1) {
    return { code: "NO_CLIPS", message: "至少需要 1 个视频片段" };
  }
  if (timeline.clips.length > MEDIA_RENDER_MAX_CLIPS) {
    return {
      code: "TOO_MANY_CLIPS",
      message: `片段数不能超过 ${MEDIA_RENDER_MAX_CLIPS}`,
    };
  }
  for (const clip of timeline.clips) {
    if (!/^https:\/\//i.test(clip.videoUrl)) {
      return {
        code: "INVALID_VIDEO_URL",
        message: `片段 ${clip.order + 1} 须为 HTTPS 视频地址`,
      };
    }
    if (clip.audioUrl && !/^https:\/\//i.test(clip.audioUrl)) {
      return {
        code: "INVALID_AUDIO_URL",
        message: `片段 ${clip.order + 1} 配音须为 HTTPS 地址`,
      };
    }
  }
  const composite = timeline.composite;
  if (composite) {
    if (composite.backgroundUrl && !/^https:\/\//i.test(composite.backgroundUrl)) {
      return {
        code: "INVALID_VIDEO_URL",
        message: "背景视频须为 HTTPS 地址",
      };
    }
    if (composite.audioUrl && !/^https:\/\//i.test(composite.audioUrl)) {
      return {
        code: "INVALID_AUDIO_URL",
        message: "口播音轨须为 HTTPS 地址",
      };
    }
  }

  const estimatedSec = timeline.clips.reduce(
    (sum, c) => sum + (c.durationSec && c.durationSec > 0 ? c.durationSec : 8),
    0,
  );
  if (estimatedSec > MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC * 1.5) {
    return {
      code: "DURATION_ESTIMATE_TOO_LONG",
      message: `预估总时长过长（上限约 ${MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC} 秒）`,
    };
  }
  return null;
}

export function mediaRenderExpiresAt(from = new Date()): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + MEDIA_RENDER_EPHEMERAL_RETENTION_DAYS);
  return d;
}
