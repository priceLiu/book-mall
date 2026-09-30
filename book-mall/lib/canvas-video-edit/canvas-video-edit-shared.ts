import { createWriteStream } from "fs";
import { Readable, Transform } from "stream";
import { pipeline } from "stream/promises";
import { execFile } from "child_process";
import { readFile, writeFile } from "fs/promises";
import { promisify } from "util";

import { FFMPEG_USER_MESSAGE } from "@/lib/media/ffmpeg-preflight";
import {
  createOssClientFrom,
  ossGetBuffer,
  readOssEnv,
  withOssRetry,
} from "@/lib/oss-client";
import { extractManagedOssObjectKey } from "@/lib/oss-delete-object";

const execFileAsync = promisify(execFile);

export const CANVAS_VIDEO_EDIT_MAX_BYTES = 200 * 1024 * 1024;
export const CANVAS_VIDEO_EDIT_DOWNLOAD_TIMEOUT_MS = 180_000;
const HTTP_DOWNLOAD_ATTEMPTS = 3;

const TRANSIENT_DOWNLOAD =
  /socket disconnected|secure TLS|ECONNRESET|ETIMEDOUT|EPIPE|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|socket hang up|network|timeout|aborted|fetch failed/i;

export function userFacingCanvasVideoEditError(raw: string): string {
  const t = raw.trim();
  if (!t) return "视频处理失败";
  if (t === FFMPEG_USER_MESSAGE) return t;
  if (
    t.includes("没有音轨") ||
    t.includes("过大") ||
    t.includes("sourceVideoUrl") ||
    t.includes("分离音频失败") ||
    t.includes("未获得") ||
    t.includes("时间") ||
    t.includes("startSec") ||
    t.includes("endSec")
  ) {
    return t;
  }
  if (TRANSIENT_DOWNLOAD.test(t) || /aliyuncs\.com|OSS/i.test(t)) {
    return "成片读取或写入云存储失败，请稍后重试";
  }
  if (t.length > 160) return "视频处理失败，请稍后重试";
  return t;
}

export async function runCanvasVideoFfmpeg(
  args: string[],
  timeoutMs = 300_000,
): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", ...args],
    { timeout: timeoutMs },
  );
}

export async function runCanvasVideoFfprobe(args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(
    "ffprobe",
    ["-hide_banner", "-loglevel", "error", ...args],
    { timeout: 60_000 },
  );
  return stdout;
}

export async function canvasVideoClipHasAudio(filePath: string): Promise<boolean> {
  try {
    const stdout = await runCanvasVideoFfprobe([
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

/** 视频时长（秒），失败时返回 null */
export async function probeCanvasVideoDurationSec(
  filePath: string,
): Promise<number | null> {
  try {
    const stdout = await runCanvasVideoFfprobe([
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const n = Number(stdout.trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  } catch {
    return null;
  }
}

async function downloadViaOssSdk(sourceVideoUrl: string, destPath: string): Promise<boolean> {
  const cfgRaw = readOssEnv();
  if ("error" in cfgRaw) return false;
  const key = extractManagedOssObjectKey(sourceVideoUrl, cfgRaw);
  if (!key) return false;

  const buf = await withOssRetry("canvas-video-edit-get", async () => {
    const client = await createOssClientFrom(cfgRaw, {
      timeoutMs: CANVAS_VIDEO_EDIT_DOWNLOAD_TIMEOUT_MS,
    });
    const got = await ossGetBuffer(client, {
      key,
      timeoutMs: CANVAS_VIDEO_EDIT_DOWNLOAD_TIMEOUT_MS,
    });
    if (!got?.byteLength) {
      throw new Error("成片为空或无法读取");
    }
    if (got.byteLength > CANVAS_VIDEO_EDIT_MAX_BYTES) {
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
        signal: AbortSignal.timeout(CANVAS_VIDEO_EDIT_DOWNLOAD_TIMEOUT_MS),
      });
      if (!res.ok) {
        throw new Error(`无法下载视频：HTTP ${res.status}`);
      }
      const len = Number(res.headers.get("content-length") ?? "0");
      if (len > 0 && len > CANVAS_VIDEO_EDIT_MAX_BYTES) {
        throw new Error("视频过大，无法处理");
      }
      const body = res.body;
      if (!body) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > CANVAS_VIDEO_EDIT_MAX_BYTES) {
          throw new Error("视频过大，无法处理");
        }
        await writeFile(destPath, buf);
        return;
      }
      let received = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          received += chunk.length;
          if (received > CANVAS_VIDEO_EDIT_MAX_BYTES) {
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

export async function downloadCanvasSourceVideoToFile(
  sourceVideoUrl: string,
  destPath: string,
): Promise<void> {
  const viaSdk = await downloadViaOssSdk(sourceVideoUrl, destPath);
  if (viaSdk) return;
  await downloadViaHttp(sourceVideoUrl, destPath);
}

export async function readLocalVideoFile(filePath: string): Promise<Buffer> {
  const buf = await readFile(filePath);
  if (!buf.byteLength) throw new Error("成片为空或无法读取");
  return buf;
}
