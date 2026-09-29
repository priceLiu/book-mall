import { createWriteStream } from "fs";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

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
  createOssClientFrom,
  ossGetBuffer,
  readOssEnv,
  withOssRetry,
} from "@/lib/oss-client";
import { extractManagedOssObjectKey } from "@/lib/oss-delete-object";

const execFileAsync = promisify(execFile);

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 180_000;
const HTTP_DOWNLOAD_ATTEMPTS = 3;

const TRANSIENT_DOWNLOAD =
  /socket disconnected|secure TLS|ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|network|timeout|aborted|fetch failed/i;

export type CanvasVideoTrackSplitMode = "strip-audio" | "extract-audio";

export function userFacingVideoTrackSplitError(raw: string): string {
  const t = raw.trim();
  if (!t) return "视频处理失败";
  if (t === FFMPEG_USER_MESSAGE) return t;
  if (
    t.includes("没有音轨") ||
    t.includes("过大") ||
    t.includes("sourceVideoUrl") ||
    t.includes("分离音频失败") ||
    t.includes("未获得")
  ) {
    return t;
  }
  if (TRANSIENT_DOWNLOAD.test(t) || /aliyuncs\.com|OSS/i.test(t)) {
    return "成片读取或写入云存储失败，请稍后重试";
  }
  if (t.length > 160) return "视频处理失败，请稍后重试";
  return t;
}

async function runFfmpeg(args: string[], timeoutMs = 300_000): Promise<void> {
  await execFileAsync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
    timeout: timeoutMs,
  });
}

async function runFfprobe(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-hide_banner", "-loglevel", "error", ...args],
    { timeout: 60_000 },
  );
  return stdout;
}

async function clipHasAudio(filePath: string): Promise<boolean> {
  try {
    const stdout = await runFfprobe([
      "-v",
      "error",
      "-select_streams",
      "a",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      filePath,
    ]);
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

async function downloadViaOssSdk(sourceVideoUrl: string, destPath: string): Promise<boolean> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) return false;
  const key = extractManagedOssObjectKey(sourceVideoUrl, cfgRaw);
  if (!key) return false;

  const buf = await withOssRetry("video-track-split-get", async () => {
    const client = await createOssClientFrom(cfgRaw, {
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
    const got = await ossGetBuffer(client, {
      key,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
    if (!got?.byteLength) {
      throw new Error("成片为空或无法读取");
    }
    if (got.byteLength > MAX_VIDEO_BYTES) {
      throw new Error("视频过大，无法处理");
    }
    return got;
  });
  await writeFile(destPath, buf);
  return true;
}

async function downloadViaHttp(url: string, destPath: string): Promise<void> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= HTTP_DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`无法下载视频：HTTP ${res.status}`);
      }
      const len = Number(res.headers.get("content-length") ?? "0");
      if (len > 0 && len > MAX_VIDEO_BYTES) {
        throw new Error("视频过大，无法处理");
      }
      const body = res.body;
      if (!body) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > MAX_VIDEO_BYTES) {
          throw new Error("视频过大，无法处理");
        }
        await writeFile(destPath, buf);
        return;
      }
      let received = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          received += chunk.length;
          if (received > MAX_VIDEO_BYTES) {
            cb(new Error("视频过大，无法处理"));
            return;
          }
          cb(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(body as import("stream/web").ReadableStream),
        limiter,
        createWriteStream(destPath),
      );
      return;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt < HTTP_DOWNLOAD_ATTEMPTS && TRANSIENT_DOWNLOAD.test(msg)) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("无法下载视频");
}

async function downloadSourceVideoToFile(
  sourceVideoUrl: string,
  destPath: string,
): Promise<void> {
  const viaSdk = await downloadViaOssSdk(sourceVideoUrl, destPath);
  if (viaSdk) return;
  await downloadViaHttp(sourceVideoUrl, destPath);
}

async function stripAudioFromVideo(inputPath: string, outputPath: string): Promise<void> {
  try {
    await runFfmpeg([
      "-y",
      "-i",
      inputPath,
      "-c:v",
      "copy",
      "-an",
      outputPath,
    ]);
  } catch {
    await runFfmpeg([
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
  await runFfmpeg([
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
    await downloadSourceVideoToFile(trimmed, inputPath);

    const hasAudio = await clipHasAudio(inputPath);
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
