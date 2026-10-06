import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { persistCanvasBufferToOss } from "@/lib/canvas/canvas-oss";
import { extractVideoFirstFrameJpegFromPath } from "@/lib/canvas/video-poster-ffmpeg";
import {
  assertFfmpegForMediaRender,
  FFMPEG_USER_MESSAGE,
} from "@/lib/media/ffmpeg-preflight";

import {
  downloadCanvasSourceVideoToFile,
  probeCanvasVideoDurationSec,
  runCanvasVideoFfmpeg,
  userFacingCanvasVideoEditError,
} from "./canvas-video-edit-shared";
import {
  assertTrimOutputDuration,
  MIN_TRIM_LEN_SEC,
} from "./canvas-video-trim-assert";

export type CanvasVideoTrimResult = {
  videoUrl: string;
  posterUrl?: string;
  startSec: number;
  endSec: number;
  durationSec: number;
};

/** 与电商 outfit clip 一致：重编码 + 输入侧 seek，避免 AI MP4 上 stream copy 裁切无效 */
async function runTrimReencodeFfmpeg(
  inputPath: string,
  startSec: number,
  clipLenSec: number,
  outPath: string,
): Promise<void> {
  await runCanvasVideoFfmpeg([
    "-y",
    "-i",
    inputPath,
    "-ss",
    String(Math.max(0, startSec)),
    "-t",
    String(Math.max(MIN_TRIM_LEN_SEC, clipLenSec)),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "20",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    outPath,
  ]);
}

export async function runCanvasVideoTrim(opts: {
  userId: string;
  projectId?: string;
  sourceVideoUrl: string;
  startSec: number;
  endSec: number;
}): Promise<CanvasVideoTrimResult> {
  await assertFfmpegForMediaRender();

  const trimmed = opts.sourceVideoUrl.trim();
  if (!trimmed) throw new Error("sourceVideoUrl 必填");

  let startSec = Number(opts.startSec);
  let endSec = Number(opts.endSec);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    throw new Error("startSec 与 endSec 须为有效数字");
  }

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vtrim-"));
    const inputPath = join(dir, "input.bin");
    await downloadCanvasSourceVideoToFile(trimmed, inputPath);

    const sourceDurationSec =
      (await probeCanvasVideoDurationSec(inputPath)) ?? endSec;
    startSec = Math.max(0, startSec);
    endSec = Math.min(sourceDurationSec, endSec);
    if (endSec - startSec < MIN_TRIM_LEN_SEC) {
      throw new Error("裁剪片段过短，请拉大入出点间距");
    }

    const rawOut = join(dir, "clip.mp4");
    const clipLenSec = endSec - startSec;

    await runTrimReencodeFfmpeg(inputPath, startSec, clipLenSec, rawOut);

    const uploadPath = rawOut;
    const probedOutDur = assertTrimOutputDuration(
      await probeCanvasVideoDurationSec(uploadPath),
      clipLenSec,
      sourceDurationSec,
    );
    const videoBuf = await readFile(uploadPath);
    if (!videoBuf.byteLength) throw new Error("裁剪未产生有效视频");

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

    return {
      videoUrl,
      posterUrl,
      startSec,
      endSec,
      durationSec: probedOutDur,
    };
  } catch (e) {
    if (e instanceof Error && e.message === FFMPEG_USER_MESSAGE) throw e;
    const message = e instanceof Error ? e.message : "裁剪失败";
    throw new Error(userFacingCanvasVideoEditError(message));
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
