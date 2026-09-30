import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { persistCanvasBufferToOss } from "@/lib/canvas/canvas-oss";
import {
  extractVideoFirstFrameJpegFromPath,
  remuxMp4FaststartFromPath,
} from "@/lib/canvas/video-poster-ffmpeg";
import {
  assertFfmpegForMediaRender,
  FFMPEG_USER_MESSAGE,
} from "@/lib/media/ffmpeg-preflight";

import {
  canvasVideoClipHasAudio,
  downloadCanvasSourceVideoToFile,
  runCanvasVideoFfmpeg,
  userFacingCanvasVideoEditError,
} from "./canvas-video-edit-shared";

export type CanvasVideoTrackSplitMode = "strip-audio" | "extract-audio";

export function userFacingVideoTrackSplitError(raw: string): string {
  return userFacingCanvasVideoEditError(raw);
}

async function stripAudioFromVideo(inputPath: string, outputPath: string): Promise<void> {
  try {
    await runCanvasVideoFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "copy",
      "-an",
      outputPath,
    ]);
  } catch {
    await runCanvasVideoFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "23",
      "-an",
      outputPath,
    ]);
  }
}

async function extractAudioFromVideo(inputPath: string, outputPath: string): Promise<void> {
  await runCanvasVideoFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-vn",
    "-acodec",
    "libmp3lame",
    "-q:a",
    "4",
    outputPath,
  ]);
}

export type CanvasVideoTrackSplitResult =
  | {
      mode: "strip-audio";
      videoUrl: string;
      posterUrl?: string;
    }
  | {
      mode: "extract-audio";
      audioUrl: string;
    };

/** 画布 · 去原音 / 分离音轨（ffmpeg，不经 Gateway） */
export async function runCanvasVideoTrackSplit(opts: {
  userId: string;
  projectId?: string;
  sourceVideoUrl: string;
  mode: CanvasVideoTrackSplitMode;
}): Promise<CanvasVideoTrackSplitResult> {
  await assertFfmpegForMediaRender();

  const trimmed = opts.sourceVideoUrl.trim();
  if (!trimmed) {
    throw new Error("sourceVideoUrl 必填");
  }

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vtrack-"));
    const inputPath = join(dir, "input.bin");
    await downloadCanvasSourceVideoToFile(trimmed, inputPath);

    const hasAudio = await canvasVideoClipHasAudio(inputPath);
    if (opts.mode === "extract-audio" && !hasAudio) {
      throw new Error("成片没有音轨，无法分离音频");
    }
    if (opts.mode === "strip-audio" && !hasAudio) {
      throw new Error("成片没有音轨，已是无声视频");
    }

    if (opts.mode === "strip-audio") {
      const rawOut = join(dir, "silent.mp4");
      const fastOut = join(dir, "silent-fast.mp4");
      await stripAudioFromVideo(inputPath, rawOut);
      const usedFast = await remuxMp4FaststartFromPath(rawOut, fastOut);
      const uploadPath = usedFast ? fastOut : rawOut;
      const videoBuf = await readFile(uploadPath);

      const videoUrl = await persistCanvasBufferToOss({
        userId: opts.userId,
        projectId: opts.projectId,
        kind: "node-video",
        ext: "mp4",
        contentType: "video/mp4",
        buf: videoBuf,
      });

      let posterUrl: string | undefined;
      const frameBuf = await extractVideoFirstFrameJpegFromPath(uploadPath);
      if (frameBuf) {
        try {
          posterUrl = await persistCanvasBufferToOss({
            userId: opts.userId,
            projectId: opts.projectId,
            kind: "node-image",
            ext: "jpg",
            contentType: "image/jpeg",
            buf: frameBuf,
          });
        } catch {
          /* 封面失败不阻断 */
        }
      }

      return { mode: "strip-audio", videoUrl, posterUrl };
    }

    const audioOut = join(dir, "track.mp3");
    await extractAudioFromVideo(inputPath, audioOut);
    const audioBuf = await readFile(audioOut);
    if (!audioBuf.byteLength) {
      throw new Error("分离音频失败");
    }

    const audioUrl = await persistCanvasBufferToOss({
      userId: opts.userId,
      projectId: opts.projectId,
      kind: "node-audio",
      ext: "mp3",
      contentType: "audio/mpeg",
      buf: audioBuf,
    });

    return { mode: "extract-audio", audioUrl };
  } catch (e) {
    if (e instanceof Error && e.message === FFMPEG_USER_MESSAGE) {
      throw e;
    }
    const message = e instanceof Error ? e.message : "视频处理失败";
    throw new Error(userFacingVideoTrackSplitError(message));
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
