import { execFile } from "child_process";
import { mkdtemp, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

import type { JianyingFrameInput } from "@/lib/canvas/canvas-jianying-export";
import { buildMergedSrt } from "@/lib/canvas/canvas-jianying-export";
import {
  extractVideoFirstFrameJpegFromPath,
  remuxMp4FaststartFromPath,
} from "@/lib/canvas/video-poster-ffmpeg";
import {
  uploadMediaRenderOutputFromPath,
  uploadMediaRenderPosterFromBuffer,
} from "@/lib/media/media-render-oss";
import {
  MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC,
  MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
} from "@/lib/media/render-limits";
import { FFMPEG_USER_MESSAGE } from "@/lib/media/ffmpeg-preflight";
import type { MediaTimelineV1, RenderProfile } from "@/lib/media/timeline-types";

const execFileAsync = promisify(execFile);

export type ProbedClip = {
  order: number;
  localPath: string;
  durationSec: number;
  subtitle?: string;
  audioUrl?: string;
};

async function fetchToFile(
  url: string,
  dest: string,
  maxBytes: number,
): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下载失败 HTTP ${res.status}: ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > maxBytes) {
    throw new Error(`源片过大（>${Math.round(maxBytes / 1024 / 1024)}MB）`);
  }
  await writeFile(dest, buf);
}

export async function ffprobeDurationSec(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  const sec = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(sec) || sec <= 0) {
    throw new Error(`无法探测视频时长: ${filePath}`);
  }
  return sec;
}

export async function ffprobeVideoSize(
  filePath: string,
): Promise<{ w: number; h: number }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height",
    "-of",
    "csv=p=0",
    filePath,
  ]);
  const [wStr, hStr] = stdout.trim().split(",");
  const w = Number.parseInt(wStr ?? "0", 10);
  const h = Number.parseInt(hStr ?? "0", 10);
  if (w <= 0 || h <= 0) {
    throw new Error(`无法探测视频分辨率: ${filePath}`);
  }
  return { w, h };
}

function makeEven(n: number): number {
  const v = Math.max(2, Math.round(n));
  return v % 2 === 0 ? v : v + 1;
}

/** 按首镜宽高比定输出画布；fit720p/fit1080p 限制长边，不再 pad 成 16:9 */
export function computeRenderTargetSize(
  sizes: { w: number; h: number }[],
  scaleMode: RenderProfile["video"]["scaleMode"],
): { w: number; h: number } {
  if (sizes.length === 0) {
    throw new Error("无可用镜头尺寸");
  }
  const ref = sizes[0]!;
  const aspect = ref.w / ref.h;

  if (scaleMode === "source") {
    return { w: makeEven(ref.w), h: makeEven(ref.h) };
  }

  const longEdgeMax = scaleMode === "fit720p" ? 1280 : 1920;

  if (aspect >= 1) {
    const w = longEdgeMax;
    return { w: makeEven(w), h: makeEven(w / aspect) };
  }
  const h = longEdgeMax;
  return { w: makeEven(h * aspect), h: makeEven(h) };
}

/** 缩放并居中裁剪到目标尺寸，避免 pad 黑边（多镜 xfade 须统一分辨率） */
function scaleFilterToTarget(tw: number, th: number): string {
  return [
    `scale=${tw}:${th}:force_original_aspect_ratio=increase`,
    `crop=${tw}:${th}`,
    "setsar=1",
    "fps=30",
  ].join(",");
}

async function clipHasAudio(filePath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
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

async function normalizeClip(
  inputPath: string,
  outputPath: string,
  targetSize: { w: number; h: number },
): Promise<void> {
  const vf = scaleFilterToTarget(targetSize.w, targetSize.h);
  const withAudio = await clipHasAudio(inputPath);
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vf",
    vf,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
  ];
  if (withAudio) {
    args.push("-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k");
  } else {
    args.push("-an");
  }
  args.push(outputPath);
  await execFileAsync("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 });
}

function buildXfadeFilterChain(
  durations: number[],
  transitionSec: number,
  withAudio: boolean,
): {
  filter: string;
  videoLabel: string;
  audioLabel: string | null;
  totalDurationSec: number;
} {
  const total =
    durations.reduce((a, b) => a + b, 0) -
    transitionSec * Math.max(0, durations.length - 1);

  if (durations.length === 1) {
    return {
      filter: withAudio ? "[0:v]copy[vout];[0:a]acopy[aout]" : "[0:v]copy[vout]",
      videoLabel: "vout",
      audioLabel: withAudio ? "aout" : null,
      totalDurationSec: durations[0]!,
    };
  }

  const parts: string[] = [];
  let prevV = "0:v";
  let prevA = "0:a";
  let offset = durations[0]! - transitionSec;

  for (let i = 1; i < durations.length; i++) {
    const vOut = i === durations.length - 1 ? "vout" : `vx${i}`;
    parts.push(
      `[${prevV}][${i}:v]xfade=transition=fade:duration=${transitionSec}:offset=${Math.max(0, offset).toFixed(3)}[${vOut}]`,
    );
    if (withAudio) {
      const aOut = i === durations.length - 1 ? "aout" : `ax${i}`;
      parts.push(`[${prevA}][${i}:a]acrossfade=d=${transitionSec}[${aOut}]`);
      prevA = aOut;
    }
    prevV = vOut;
    offset += durations[i]! - transitionSec;
  }

  return {
    filter: parts.join(";"),
    videoLabel: "vout",
    audioLabel: withAudio ? "aout" : null,
    totalDurationSec: total,
  };
}

async function concatCopy(partPaths: string[], outPath: string): Promise<void> {
  const listPath = join(join(outPath, ".."), "concat.txt");
  const listBody = partPaths
    .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
    .join("\n");
  await writeFile(listPath, listBody);
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listPath,
    "-c",
    "copy",
    outPath,
  ]);
}

function escapeFfmpegSubtitlesPath(srtPath: string): string {
  return srtPath.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "'\\''");
}

/** 对已合并视频烧录 SRT（单镜 concat 与多镜 xfade 共用）。 */
async function burnSubtitlesIntoVideo(
  inputPath: string,
  srtPath: string,
  outPath: string,
): Promise<void> {
  const escaped = escapeFfmpegSubtitlesPath(srtPath);
  const withAudio = await clipHasAudio(inputPath);
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vf",
    `subtitles='${escaped}'`,
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
  ];
  if (withAudio) {
    args.push("-c:a", "copy");
  } else {
    args.push("-an");
  }
  args.push(outPath);
  await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
}

async function renderXfade(
  normPaths: string[],
  durations: number[],
  profile: RenderProfile,
  outPath: string,
  srtPath?: string,
): Promise<void> {
  const transitionSec =
    profile.transition.type === "xfade" ? profile.transition.durationSec : 0;
  const needBurn = Boolean(srtPath?.trim() && profile.subtitle.burnIn);
  const mergedPath = needBurn
    ? join(join(outPath, ".."), "merged-pre-subs.mp4")
    : outPath;

  if (transitionSec <= 0 || normPaths.length === 1) {
    await concatCopy(normPaths, mergedPath);
    if (needBurn) {
      await burnSubtitlesIntoVideo(mergedPath, srtPath!, outPath);
    }
    return;
  }

  const withAudio = (await Promise.all(normPaths.map((p) => clipHasAudio(p)))).every(
    Boolean,
  );
  const { filter, videoLabel, audioLabel } = buildXfadeFilterChain(
    durations,
    transitionSec,
    withAudio,
  );
  const inputs = normPaths.flatMap((p) => ["-i", p]);
  let complex = filter;
  let mapVideo = videoLabel;
  if (needBurn) {
    const escaped = escapeFfmpegSubtitlesPath(srtPath!);
    complex += `;[${videoLabel}]subtitles='${escaped}'[vfinal]`;
    mapVideo = "vfinal";
  }
  const args = [
    "-y",
    ...inputs,
    "-filter_complex",
    complex,
    "-map",
    `[${mapVideo}]`,
  ];
  if (audioLabel) {
    args.push("-map", `[${audioLabel}]`, "-c:a", "aac", "-b:a", "128k");
  }
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    outPath,
  );

  await execFileAsync("ffmpeg", args, { maxBuffer: 20 * 1024 * 1024 });
}

export function timelineToSrtFrames(
  timeline: MediaTimelineV1,
  durations: number[],
): JianyingFrameInput[] {
  return timeline.clips.map((c, i) => ({
    frameIndex: c.order + 1,
    dialogue: c.subtitle ?? "",
    durationSec: durations[i] ?? c.durationSec ?? 3,
  }));
}

export type RenderFfmpegResult = {
  ossUrl: string;
  posterUrl?: string;
  bytesOut: number;
  totalDurationSec: number;
  srtContent?: string;
};

export async function runFfmpegMediaRender(args: {
  userId: string;
  jobId: string;
  timeline: MediaTimelineV1;
  profile: RenderProfile;
  onProgress?: (pct: number, label: string) => void;
}): Promise<RenderFfmpegResult> {
  const { timeline, profile, userId, jobId } = args;
  const clipCount = timeline.clips.length;
  const tmp = await mkdtemp(join(tmpdir(), "media-render-"));
  try {
    args.onProgress?.(2, "准备剪辑环境");
    const probed: ProbedClip[] = [];
    const sourceSizes: { w: number; h: number }[] = [];
    for (let i = 0; i < timeline.clips.length; i++) {
      const clip = timeline.clips[i]!;
      args.onProgress?.(
        5 + Math.round((i / Math.max(clipCount, 1)) * 25),
        `下载第 ${i + 1}/${clipCount} 镜视频`,
      );
      const rawPath = join(tmp, `raw-${i}.mp4`);
      await fetchToFile(
        clip.videoUrl,
        rawPath,
        MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
      );
      const durationSec =
        clip.durationSec && clip.durationSec > 0
          ? clip.durationSec
          : await ffprobeDurationSec(rawPath);
      const size = await ffprobeVideoSize(rawPath);
      sourceSizes.push(size);
      probed.push({
        order: clip.order,
        localPath: rawPath,
        durationSec,
        subtitle: clip.subtitle,
        audioUrl: clip.audioUrl,
      });
      args.onProgress?.(
        5 + Math.round(((i + 1) / clipCount) * 25),
        `已下载第 ${i + 1}/${clipCount} 镜`,
      );
    }

    const durations = probed.map((p) => p.durationSec);
    const totalEstimate =
      profile.transition.type === "xfade" && probed.length > 1
        ? durations.reduce((a, b) => a + b, 0) -
          profile.transition.durationSec * (probed.length - 1)
        : durations.reduce((a, b) => a + b, 0);

    if (totalEstimate > MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC) {
      throw new Error(
        `成片时长 ${Math.round(totalEstimate)}s 超过上限 ${MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC}s`,
      );
    }

    const targetSize = computeRenderTargetSize(
      sourceSizes,
      profile.video.scaleMode,
    );
    const targetLabel = `${targetSize.w}×${targetSize.h}`;

    const normPaths: string[] = [];
    for (let i = 0; i < probed.length; i++) {
      args.onProgress?.(
        35 + Math.round((i / Math.max(probed.length, 1)) * 30),
        `标准化第 ${i + 1}/${probed.length} 镜（${targetLabel}）`,
      );
      const normPath = join(tmp, `norm-${i}.mp4`);
      await normalizeClip(probed[i]!.localPath, normPath, targetSize);
      normPaths.push(normPath);
      args.onProgress?.(
        35 + Math.round(((i + 1) / probed.length) * 30),
        `已标准化第 ${i + 1}/${probed.length} 镜`,
      );
    }

    const srtFrames = timelineToSrtFrames(timeline, durations);
    const srtContent =
      profile.subtitle.mode === "script" ? buildMergedSrt(srtFrames) : undefined;
    let srtPath: string | undefined;
    if (srtContent?.trim()) {
      args.onProgress?.(68, "生成字幕文件");
      srtPath = join(tmp, "subs.srt");
      await writeFile(srtPath, srtContent, "utf8");
    }

    const outPath = join(tmp, "merged.mp4");
    const xfadeLabel =
      profile.transition.type === "xfade" && normPaths.length > 1
        ? profile.subtitle.burnIn
          ? "合并转场并烧录字幕"
          : "合并转场"
        : profile.subtitle.burnIn
          ? "拼接镜头并烧录字幕"
          : "拼接镜头";
    args.onProgress?.(72, xfadeLabel);
    await renderXfade(normPaths, durations, profile, outPath, srtPath);
    args.onProgress?.(85, "编码完成，准备上传");

    const fastPath = join(tmp, "merged-faststart.mp4");
    const faststarted = await remuxMp4FaststartFromPath(outPath, fastPath);
    const uploadPath = faststarted ? fastPath : outPath;

    const outStat = await stat(uploadPath);
    const outMb = Math.max(1, Math.round(outStat.size / 1024 / 1024));
    args.onProgress?.(86, `生成封面（约 ${outMb}MB 成片）`);

    let posterUrl: string | undefined;
    const posterBuf = await extractVideoFirstFrameJpegFromPath(uploadPath);
    if (posterBuf) {
      try {
        posterUrl = await uploadMediaRenderPosterFromBuffer({
          userId,
          jobId,
          buf: posterBuf,
        });
      } catch {
        /* 封面失败不阻断成片 */
      }
    }

    args.onProgress?.(88, `上传成片到云端（约 ${outMb}MB）`);
    const { url: ossUrl, bytesOut } = await uploadMediaRenderOutputFromPath({
      userId,
      jobId,
      filePath: uploadPath,
      onUploadProgress: (ratio) => {
        const pct = 88 + Math.round(Math.min(1, ratio) * 10);
        const uploadPct = Math.round(Math.min(1, ratio) * 100);
        args.onProgress?.(
          Math.min(99, pct),
          ratio >= 0.999 ? "上传完成，正在收尾" : `上传中 ${uploadPct}%`,
        );
      },
    });
    args.onProgress?.(100, "剪辑完成");

    return {
      ossUrl,
      posterUrl,
      bytesOut,
      totalDurationSec: totalEstimate,
      srtContent: srtContent?.trim() || undefined,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("ENOENT") || /ffmpeg|ffprobe/i.test(msg)) {
      throw new Error(FFMPEG_USER_MESSAGE);
    }
    throw e;
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  }
}
