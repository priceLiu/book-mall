import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import {
  GatewayRequiredError,
  resolveGatewayAuthForBookUser,
} from "@/lib/gateway/book-gateway-link";
import { GatewayV1AsrError, runGatewayV1AsrTranscribe } from "@/lib/gateway/gateway-v1-asr-service";
import { gatewayV1ClientMetaForBookUser } from "@/lib/gateway/gateway-log-meta-for-user";
import { resolveCanvasProjectTeamTenantId } from "@/lib/gateway/resolve-canvas-project-team-tenant";
import { isDashscopeAsrNoSpeechOutcome } from "@/lib/gateway/dashscope-client";
import { buildAsrSubtitleSrtFromGlobalSegments } from "@/lib/media/asr-subtitle";
import {
  assertFfmpegForMediaRender,
  FFMPEG_USER_MESSAGE,
} from "@/lib/media/ffmpeg-preflight";

import {
  canvasVideoClipHasAudio,
  downloadCanvasSourceVideoToFile,
  probeCanvasVideoDurationSec,
  userFacingCanvasVideoEditError,
} from "./canvas-video-edit-shared";

/** 与截帧 / 时间条一致 */
export const CANVAS_VIDEO_SUBTITLE_EXTRACT_MAX_DURATION_SEC = 300;

export type CanvasVideoSubtitleExtractResult = {
  srt: string;
  segments: Array<{ startMs: number; endMs: number; text: string }>;
  durationSec?: number;
  noSpeech?: boolean;
};

export async function runCanvasVideoSubtitleExtract(opts: {
  userId: string;
  projectId?: string;
  sourceVideoUrl: string;
}): Promise<CanvasVideoSubtitleExtractResult> {
  await assertFfmpegForMediaRender();

  const trimmed = opts.sourceVideoUrl.trim();
  if (!trimmed) throw new Error("sourceVideoUrl 必填");

  const auth = await resolveGatewayAuthForBookUser(opts.userId);
  if (!auth?.id) {
    throw new GatewayRequiredError(
      "请先在 Book 个人中心关联 Gateway API Key",
      "GATEWAY_KEY_REQUIRED",
      403,
    );
  }

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vsub-"));
    const inputPath = join(dir, "input.bin");
    await downloadCanvasSourceVideoToFile(trimmed, inputPath);

    const durationSec = await probeCanvasVideoDurationSec(inputPath);
    if (
      durationSec != null &&
      durationSec > CANVAS_VIDEO_SUBTITLE_EXTRACT_MAX_DURATION_SEC
    ) {
      throw new Error(
        `视频时长超过 ${CANVAS_VIDEO_SUBTITLE_EXTRACT_MAX_DURATION_SEC} 秒，请裁剪后再提取字幕`,
      );
    }

    const hasAudio = await canvasVideoClipHasAudio(inputPath);
    if (!hasAudio) {
      throw new Error("成片没有音轨，无法提取字幕");
    }

    const preferredTenantId = opts.projectId
      ? await resolveCanvasProjectTeamTenantId(opts.projectId)
      : undefined;
    const logMeta = await gatewayV1ClientMetaForBookUser("CANVAS", opts.userId, {
      clientPage: "canvas-video-subtitle-extract",
      preferredTenantId,
    });

    let segments: Array<{ startMs: number; endMs: number; text: string }> =
      [];
    try {
      const asr = await runGatewayV1AsrTranscribe({
        auth,
        fileUrl: trimmed,
        logMeta,
        cacheKey: `canvas-vsub:${opts.userId}:${trimmed.slice(0, 120)}`,
      });
      segments = asr.segments;
      if (asr.noSpeech) {
        return {
          srt: "",
          segments: [],
          durationSec: durationSec ?? undefined,
          noSpeech: true,
        };
      }
    } catch (e) {
      if (e instanceof GatewayV1AsrError) {
        if (isDashscopeAsrNoSpeechOutcome(undefined, e.message, e.message)) {
          return {
            srt: "",
            segments: [],
            durationSec: durationSec ?? undefined,
            noSpeech: true,
          };
        }
        throw new Error(e.message);
      }
      throw e;
    }

    const srt = buildAsrSubtitleSrtFromGlobalSegments(segments);
    return {
      srt,
      segments,
      durationSec: durationSec ?? undefined,
      noSpeech: segments.length === 0,
    };
  } catch (e) {
    if (e instanceof GatewayRequiredError) throw e;
    const raw = e instanceof Error ? e.message : String(e);
    if (raw === FFMPEG_USER_MESSAGE) throw e;
    throw new Error(userFacingCanvasVideoEditError(raw));
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
