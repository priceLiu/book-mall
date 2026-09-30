import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { persistCanvasBufferToOss } from "@/lib/canvas/canvas-oss";
import {
  extractVideoFirstFrameJpegFromPath,
  extractVideoFrameJpegAtSecFromPath,
  extractVideoLastFrameJpegFromPath,
} from "@/lib/canvas/video-poster-ffmpeg";
import {
  assertFfmpegForMediaRender,
  FFMPEG_USER_MESSAGE,
} from "@/lib/media/ffmpeg-preflight";

import {
  downloadCanvasSourceVideoToFile,
  probeCanvasVideoDurationSec,
  userFacingCanvasVideoEditError,
} from "./canvas-video-edit-shared";

export type CanvasVideoFrameExtractMode = "first" | "last" | "at";

export type CanvasVideoFrameExtractResult = {
  imageUrl: string;
  capturedAtSec: number;
  durationSec?: number;
};

export async function runCanvasVideoFrameExtract(opts: {
  userId: string;
  projectId?: string;
  sourceVideoUrl: string;
  mode: CanvasVideoFrameExtractMode;
  atSec?: number | null;
}): Promise<CanvasVideoFrameExtractResult> {
  await assertFfmpegForMediaRender();

  const trimmed = opts.sourceVideoUrl.trim();
  if (!trimmed) throw new Error("sourceVideoUrl 必填");

  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vframe-"));
    const inputPath = join(dir, "input.bin");
    await downloadCanvasSourceVideoToFile(trimmed, inputPath);

    const durationSec = await probeCanvasVideoDurationSec(inputPath);

    let frameBuf: Buffer | null = null;
    let capturedAtSec = 0;

    if (opts.mode === "first") {
      frameBuf = await extractVideoFirstFrameJpegFromPath(inputPath);
      capturedAtSec = 0;
    } else if (opts.mode === "last") {
      frameBuf = await extractVideoLastFrameJpegFromPath(inputPath, durationSec);
      capturedAtSec =
        durationSec != null ? Math.max(0, durationSec - 0.05) : 0;
    } else {
      const raw = opts.atSec;
      if (raw == null || !Number.isFinite(raw)) {
        throw new Error("自定义截帧须提供 atSec");
      }
      const max = durationSec ?? raw;
      const at = Math.min(Math.max(0, raw), Math.max(0, max - 0.04));
      frameBuf = await extractVideoFrameJpegAtSecFromPath(inputPath, at);
      capturedAtSec = at;
    }

    if (!frameBuf?.byteLength) {
      throw new Error("截帧失败，请换一段视频或稍后重试");
    }

    const imageUrl = await persistCanvasBufferToOss({
      userId: opts.userId,
      projectId: opts.projectId,
      kind: "node-image",
      ext: "jpg",
      contentType: "image/jpeg",
      buf: frameBuf,
    });

    return {
      imageUrl,
      capturedAtSec,
      durationSec: durationSec ?? undefined,
    };
  } catch (e) {
    if (e instanceof Error && e.message === FFMPEG_USER_MESSAGE) throw e;
    const message = e instanceof Error ? e.message : "截帧失败";
    throw new Error(userFacingCanvasVideoEditError(message));
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}
