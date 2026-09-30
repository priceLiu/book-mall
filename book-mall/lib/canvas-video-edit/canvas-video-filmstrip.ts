import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { persistCanvasBufferToOss } from "@/lib/canvas/canvas-oss";
import { extractVideoFrameJpegAtSecFromPath } from "@/lib/canvas/video-poster-ffmpeg";
import {
  assertFfmpegForMediaRender,
  FFMPEG_USER_MESSAGE,
} from "@/lib/media/ffmpeg-preflight";

import {
  downloadCanvasSourceVideoToFile,
  probeCanvasVideoDurationSec,
  userFacingCanvasVideoEditError,
} from "./canvas-video-edit-shared";

export type CanvasVideoFilmstripFrame = {
  atSec: number;
  thumbnailUrl: string;
};

export type CanvasVideoFilmstripResult = {
  durationSec: number;
  frames: CanvasVideoFilmstripFrame[];
};

const DEFAULT_FRAME_COUNT = 16;
const MAX_FRAME_COUNT = 24;

function resolveFrameTimes(durationSec: number, count: number): number[] {
  const n = Math.max(2, Math.min(MAX_FRAME_COUNT, Math.round(count)));
  if (durationSec <= 0) return [0];
  const times: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === n - 1) {
      times.push(Math.max(0, durationSec - 0.08));
    } else {
      times.push((durationSec * i) / (n - 1));
    }
  }
  return times;
}

export async function runCanvasVideoFilmstrip(opts: {
  userId: string;
  projectId?: string;
  sourceVideoUrl: string;
  frameCount?: number | null;
}): Promise<CanvasVideoFilmstripResult> {
  await assertFfmpegForMediaRender();

  const trimmed = opts.sourceVideoUrl.trim();
  if (!trimmed) throw new Error("sourceVideoUrl 必填");

  const count =
    opts.frameCount != null && Number.isFinite(opts.frameCount)
      ? opts.frameCount
      : DEFAULT_FRAME_COUNT;

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vstrip-"));
    const inputPath = join(dir, "input.bin");
    await downloadCanvasSourceVideoToFile(trimmed, inputPath);

    const durationSec = (await probeCanvasVideoDurationSec(inputPath)) ?? 1;
    const times = resolveFrameTimes(durationSec, count);

    const frames: CanvasVideoFilmstripFrame[] = [];

    for (let i = 0; i < times.length; i++) {
      const atSec = times[i]!;
      const buf = await extractVideoFrameJpegAtSecFromPath(inputPath, atSec);
      if (!buf?.byteLength) continue;
      const thumbnailUrl = await persistCanvasBufferToOss({
        userId: opts.userId,
        projectId: opts.projectId,
        kind: "node-image",
        ext: "jpg",
        contentType: "image/jpeg",
        buf,
      });
      frames.push({ atSec, thumbnailUrl });
    }

    if (frames.length === 0) {
      throw new Error("无法生成时间轴缩略图");
    }

    return { durationSec, frames };
  } catch (e) {
    if (e instanceof Error && e.message === FFMPEG_USER_MESSAGE) throw e;
    const message = e instanceof Error ? e.message : "缩略图生成失败";
    throw new Error(userFacingCanvasVideoEditError(message));
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
