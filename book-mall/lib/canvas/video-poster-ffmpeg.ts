import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function extractVideoFrameJpegFromPathAt(
  filePath: string,
  seekArgs: string[],
): Promise<Buffer | null> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vposter-"));
    const output = join(dir, "frame.jpg");
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        ...seekArgs,
        "-i",
        filePath,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        output,
      ],
      { timeout: 120_000 },
    );
    const frame = await readFile(output);
    return frame.byteLength > 0 ? frame : null;
  } catch {
    return null;
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** 从本地 mp4 截取第一帧 JPEG；失败返回 null（不阻断入库）。 */
export async function extractVideoFirstFrameJpegFromPath(
  filePath: string,
): Promise<Buffer | null> {
  return extractVideoFrameJpegFromPathAt(filePath, []);
}

/** 指定时刻（秒）截帧 · 输入侧 fast seek（`-ss` 在 `-i` 前）。 */
export async function extractVideoFrameJpegAtSecFromPath(
  filePath: string,
  atSec: number,
): Promise<Buffer | null> {
  const t = Math.max(0, atSec);
  if (t <= 1e-6) return extractVideoFirstFrameJpegFromPath(filePath);
  return extractVideoFrameJpegFromPathAt(filePath, ["-ss", String(t)]);
}

/** 指定时刻 · 输出侧 seek（`-i` 后再 `-ss`，更准，适合尾帧）。 */
export async function extractVideoFrameJpegAccurateAtSecFromPath(
  filePath: string,
  atSec: number,
): Promise<Buffer | null> {
  const t = Math.max(0, atSec);
  if (t <= 1e-6) return extractVideoFirstFrameJpegFromPath(filePath);
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vposter-acc-"));
    const output = join(dir, "frame.jpg");
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        filePath,
        "-ss",
        String(t),
        "-frames:v",
        "1",
        "-q:v",
        "4",
        output,
      ],
      { timeout: 120_000 },
    );
    const frame = await readFile(output);
    return frame.byteLength > 0 ? frame : null;
  } catch {
    return null;
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/** 尾帧：优先 duration 精确 seek，再回退 sseof（部分 mp4 仅 sseof 会失败）。 */
export async function extractVideoLastFrameJpegFromPath(
  filePath: string,
  durationSec?: number | null,
): Promise<Buffer | null> {
  const epsilon = 0.05;
  if (durationSec != null && Number.isFinite(durationSec) && durationSec > epsilon) {
    const at = Math.max(0, durationSec - epsilon);
    const accurate = await extractVideoFrameJpegAccurateAtSecFromPath(filePath, at);
    if (accurate) return accurate;
    const fast = await extractVideoFrameJpegAtSecFromPath(filePath, at);
    if (fast) return fast;
  }
  for (const tail of ["-0.08", "-0.25", "-1"]) {
    const buf = await extractVideoFrameJpegFromPathAt(filePath, ["-sseof", tail]);
    if (buf) return buf;
  }
  return null;
}

/** 将 moov atom 移到文件头（faststart），输出到新路径；失败返回 false。 */
export async function remuxMp4FaststartFromPath(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  try {
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        outputPath,
      ],
      { timeout: 120_000 },
    );
    const out = await readFile(outputPath);
    return out.byteLength > 0;
  } catch {
    return false;
  }
}

/** 从 mp4 buffer 截取第一帧 JPEG；ffmpeg 不可用或失败时返回 null（不阻断视频入库）。 */
export async function extractVideoFirstFrameJpeg(
  videoBuf: Buffer,
): Promise<Buffer | null> {
  if (!videoBuf.byteLength) return null;
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-vposter-"));
    const input = join(dir, "in.mp4");
    const output = join(dir, "frame.jpg");
    await writeFile(input, videoBuf);
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        output,
      ],
      { timeout: 120_000 },
    );
    const frame = await readFile(output);
    return frame.byteLength > 0 ? frame : null;
  } catch {
    return null;
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

/**
 * 用 `-c copy` 将 mp4/mov 的 moov atom 移到文件头（faststart），
 * 让浏览器「边下边播」而非整段下载后才能播放——根治 AI 视频「打开转圈缓冲」。
 * `-c copy` 不重编码（极快、无损）；ffmpeg 不可用 / 非 mp4 / 失败时返回 null（调用方回退原始 buffer）。
 */
export async function remuxMp4Faststart(
  videoBuf: Buffer,
  ext: string,
): Promise<Buffer | null> {
  if (!videoBuf.byteLength) return null;
  const lower = (ext || "").toLowerCase();
  if (lower !== "mp4" && lower !== "mov" && lower !== "m4v") return null;
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "canvas-faststart-"));
    const input = join(dir, `in.${lower}`);
    const output = join(dir, `out.${lower}`);
    await writeFile(input, videoBuf);
    await execFileAsync(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        input,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        output,
      ],
      { timeout: 120_000 },
    );
    const out = await readFile(output);
    return out.byteLength > 0 ? out : null;
  } catch {
    return null;
  } finally {
    if (dir) {
      await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

export function extractPosterUrlFromResultPayload(
  resultPayload: unknown,
): string | null {
  if (!resultPayload || typeof resultPayload !== "object" || Array.isArray(resultPayload)) {
    return null;
  }
  const url = (resultPayload as { posterUrl?: unknown }).posterUrl;
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  return /^https?:\/\//.test(trimmed) ? trimmed : null;
}

export function mergeResultPayloadPoster(
  raw: unknown,
  posterUrl?: string,
): Record<string, unknown> {
  const base =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? { ...(raw as Record<string, unknown>) }
      : {};
  if (posterUrl?.trim()) {
    base.posterUrl = posterUrl.trim();
  }
  return base;
}
