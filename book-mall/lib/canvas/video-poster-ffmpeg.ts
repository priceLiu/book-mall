import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

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
