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
