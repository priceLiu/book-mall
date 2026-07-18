import { access, copyFile, mkdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const BASE_DIR = join(tmpdir(), "media-render-output");

export function mediaRenderLocalOutputPath(jobId: string): string {
  return join(BASE_DIR, jobId, "output.mp4");
}

export async function ensureMediaRenderLocalOutputDir(jobId: string): Promise<string> {
  const dir = join(BASE_DIR, jobId);
  await mkdir(dir, { recursive: true });
  return dir;
}

export async function persistMediaRenderLocalOutput(
  jobId: string,
  sourcePath: string,
): Promise<{ path: string; bytesOut: number }> {
  await ensureMediaRenderLocalOutputDir(jobId);
  const dest = mediaRenderLocalOutputPath(jobId);
  await copyFile(sourcePath, dest);
  const st = await stat(dest);
  return { path: dest, bytesOut: st.size };
}

export async function hasMediaRenderLocalOutput(jobId: string): Promise<boolean> {
  try {
    await access(mediaRenderLocalOutputPath(jobId));
    return true;
  } catch {
    return false;
  }
}

export async function cleanupMediaRenderLocalOutput(jobId: string): Promise<void> {
  await rm(join(BASE_DIR, jobId), { recursive: true, force: true }).catch(
    () => undefined,
  );
}
