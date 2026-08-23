import { createWriteStream } from "fs";
import { Transform } from "stream";
import { pipeline } from "stream/promises";
import { Readable } from "stream";

import { mkdtemp, rm, stat, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import type { JianyingFrameInput } from "@/lib/canvas/canvas-jianying-export";
import { buildMergedSrt } from "@/lib/canvas/canvas-jianying-export";
import {
  buildAsrSubtitleSrt,
  transcribeClipViaGateway,
} from "@/lib/media/asr-subtitle";
import { QWEN3_ASR_FLASH_FILETRANS_MODEL } from "@/lib/gateway/dashscope-client";
import { remuxMp4FaststartFromPath } from "@/lib/canvas/video-poster-ffmpeg";
import { runFfmpeg, runFfprobe } from "@/lib/media/ffmpeg-exec";
import { persistMediaRenderLocalOutput } from "@/lib/media/media-render-local-output";
import {
  MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC,
  MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
} from "@/lib/media/render-limits";
import { FFMPEG_USER_MESSAGE } from "@/lib/media/ffmpeg-preflight";
import {
  buildSubtitlesFilterExpr,
  buildSubtitleBurnInFilterOverrides,
  resolveSubtitleFontByKey,
} from "@/lib/media/subtitle-ffmpeg-style";
import type {
  CompositeOverlay,
  MediaTimelineV1,
  RenderProfile,
} from "@/lib/media/timeline-types";

/** 字幕基线与画中画小窗之间的留白 */
const SUBTITLE_OVERLAY_GAP_PX = 16;
/** ffmpeg 把 SRT 转 ASS 时的默认脚本画布高度（force_style 的 MarginV 以此为基准） */
const ASS_DEFAULT_PLAY_RES_Y = 288;

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
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(180_000),
      });
      if (!res.ok) {
        throw new Error(`下载失败 HTTP ${res.status}: ${url}`);
      }
      const contentLength = Number(res.headers.get("content-length") ?? "0");
      if (contentLength > maxBytes) {
        throw new Error(`源片过大（>${Math.round(maxBytes / 1024 / 1024)}MB）`);
      }
      const body = res.body;
      if (!body) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength > maxBytes) {
          throw new Error(`源片过大（>${Math.round(maxBytes / 1024 / 1024)}MB）`);
        }
        await writeFile(dest, buf);
        return;
      }
      let received = 0;
      const limiter = new Transform({
        transform(chunk: Buffer, _enc, cb) {
          received += chunk.length;
          if (received > maxBytes) {
            cb(new Error(`源片过大（>${Math.round(maxBytes / 1024 / 1024)}MB）`));
            return;
          }
          cb(null, chunk);
        },
      });
      await pipeline(
        Readable.fromWeb(body as import("stream/web").ReadableStream),
        limiter,
        createWriteStream(dest),
      );
      return;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("下载源片失败");
}

export async function ffprobeDurationSec(filePath: string): Promise<number> {
  const stdout = await runFfprobe([
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
  const stdout = await runFfprobe([
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

/** 种草逐镜合成：profile.audio.mixTts 默认 true，须把 clip.audioUrl（TTS）混入成片 */
export function resolveMixTtsEnabled(profile: RenderProfile): boolean {
  return profile.audio?.mixTts !== false;
}

function buildVoiceoverAudioFilter(durationSec: number): string {
  const dur = durationSec.toFixed(3);
  return `[1:a]aformat=sample_rates=44100:channel_layouts=stereo,apad=whole_dur=${dur},atrim=0:${dur},asetpts=PTS-STARTPTS[aout]`;
}

/** 将 TTS 口播对齐到镜头时长并写入标准化镜头（保留视频轨，替换/新增音轨） */
async function attachVoiceoverToNormalizedClip(args: {
  videoPath: string;
  audioUrl: string;
  durationSec: number;
  outPath: string;
}): Promise<void> {
  const audioPath = join(join(args.videoPath, ".."), `voice-${args.outPath.split("/").pop()}`);
  await fetchToFile(
    args.audioUrl,
    audioPath,
    MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
  );
  try {
    const dur = args.durationSec.toFixed(3);
    await runFfmpeg([
      "-y",
      "-i",
      args.videoPath,
      "-i",
      audioPath,
      "-filter_complex",
      buildVoiceoverAudioFilter(args.durationSec),
      "-map",
      "0:v",
      "-map",
      "[aout]",
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      "128k",
      "-t",
      dur,
      args.outPath,
    ]);
  } finally {
    await rm(audioPath, { force: true }).catch(() => undefined);
  }
}

async function attachSilentAudioToNormalizedClip(args: {
  videoPath: string;
  durationSec: number;
  outPath: string;
}): Promise<void> {
  const dur = args.durationSec.toFixed(3);
  await runFfmpeg([
    "-y",
    "-i",
    args.videoPath,
    "-f",
    "lavfi",
    "-i",
    "anullsrc=r=44100:cl=stereo",
    "-filter_complex",
    `[1:a]atrim=0:${dur},asetpts=PTS-STARTPTS[aout]`,
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-ar",
    "44100",
    "-ac",
    "2",
    "-b:a",
    "128k",
    "-t",
    dur,
    args.outPath,
  ]);
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
  await runFfmpeg(args);
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
  await runFfmpeg([
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

/** 对已合并视频烧录 SRT（单镜 concat 与多镜 xfade 共用）。 */
async function burnSubtitlesIntoVideo(
  inputPath: string,
  srtPath: string,
  outPath: string,
  profile: RenderProfile,
): Promise<void> {
  const styleOverrides = buildSubtitleBurnInFilterOverrides(profile.subtitle.style);
  const withAudio = await clipHasAudio(inputPath);
  const args = [
    "-y",
    "-i",
    inputPath,
    "-vf",
    buildSubtitlesFilterExpr(srtPath, styleOverrides),
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
  await runFfmpeg(args);
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
      await burnSubtitlesIntoVideo(mergedPath, srtPath!, outPath, profile);
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
    const styleOverrides = buildSubtitleBurnInFilterOverrides(profile.subtitle.style);
    complex += `;[${videoLabel}]${buildSubtitlesFilterExpr(srtPath!, styleOverrides)}[vfinal]`;
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

  await runFfmpeg(args);
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
  localPath: string;
  bytesOut: number;
  totalDurationSec: number;
  srtContent?: string;
};

function overlayPositionExpr(
  position: CompositeOverlay["position"],
  marginPx: number,
): string {
  switch (position) {
    case "bottom-left":
      return `${marginPx}:main_h-overlay_h-${marginPx}`;
    case "top-right":
      return `main_w-overlay_w-${marginPx}:${marginPx}`;
    case "top-left":
      return `${marginPx}:${marginPx}`;
    case "center":
      return "(main_w-overlay_w)/2:(main_h-overlay_h)/2";
    default:
      return `main_w-overlay_w-${marginPx}:main_h-overlay_h-${marginPx}`;
  }
}

function overlayEnableExpr(
  overlay: CompositeOverlay,
  durationSec: number,
): string {
  const from = overlay.appearFromSec ?? 0;
  const to =
    overlay.appearToSec != null && overlay.appearToSec >= 0
      ? overlay.appearToSec
      : durationSec;
  if (from <= 0 && to >= durationSec - 0.05) return "";
  return `:enable='between(t,${from.toFixed(3)},${to.toFixed(3)})'`;
}

function srtTimestamp(totalSec: number): string {
  const ms = Math.max(0, Math.round(totalSec * 1000));
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const rest = ms % 1000;
  const p = (n: number, len = 2) => n.toString().padStart(len, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(rest, 3)}`;
}

/**
 * 整段台词按时长均分成字幕行（口播视频无逐字时间戳时的近似方案）。
 * 按中文标点断句，句长权重分配时间。
 */
export function buildCompositeSrt(text: string, durationSec: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean || durationSec <= 0) return "";
  const sentences = clean
    .split(/(?<=[。！？；.!?;])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const lines = sentences.length > 0 ? sentences : [clean];
  const totalChars = lines.reduce((sum, l) => sum + l.length, 0) || 1;

  const blocks: string[] = [];
  let cursor = 0;
  lines.forEach((line, i) => {
    const share = (line.length / totalChars) * durationSec;
    const start = cursor;
    const end = i === lines.length - 1 ? durationSec : cursor + share;
    cursor = end;
    blocks.push(
      `${i + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(end)}\n${line}\n`,
    );
  });
  return blocks.join("\n");
}

/**
 * 底部小窗会压住默认位置的字幕，此时把字幕抬到小窗上沿之上。
 * 返回 ASS `MarginV`（脚本坐标）；无需抬高时为 undefined。
 */
async function subtitleMarginVForOverlay(args: {
  foregroundPath: string;
  overlay: CompositeOverlay;
  targetWidth: number;
  targetHeight: number;
  hasBackground: boolean;
}): Promise<number | undefined> {
  if (!args.hasBackground) return undefined;
  if (!args.overlay.position.startsWith("bottom")) return undefined;

  const fgSize = await ffprobeVideoSize(args.foregroundPath).catch(() => null);
  if (!fgSize || fgSize.w <= 0) return undefined;

  const overlayW = Math.max(2, Math.round(args.targetWidth * args.overlay.scale));
  const overlayH = Math.round((overlayW * fgSize.h) / fgSize.w);
  const marginPx = args.overlay.marginPx + overlayH + SUBTITLE_OVERLAY_GAP_PX;
  // MarginV 用的是 ASS 脚本坐标，需按 SRT→ASS 的默认画布高度换算回去
  return Math.round((marginPx * ASS_DEFAULT_PLAY_RES_Y) / args.targetHeight);
}

/**
 * 画中画合成：背景循环铺底 + 前景口播叠加 + 可替换音轨 + 可选字幕。
 *
 * 输出时长以 **前景** 为准（`-shortest` 配合背景 `-stream_loop -1`）。
 */
async function runCompositeFfmpeg(args: {
  foregroundPath: string;
  backgroundPath: string | null;
  audioPath: string | null;
  overlay: CompositeOverlay;
  targetSize: { w: number; h: number };
  foregroundDurationSec: number;
  srtPath: string | null;
  subtitleStyle?: RenderProfile["subtitle"]["style"];
  outPath: string;
}): Promise<void> {
  const { targetSize, overlay } = args;
  const inputs: string[] = [];
  const filters: string[] = [];

  if (args.backgroundPath) {
    // 背景短于前景时循环铺底；trim 保证不超出前景时长
    inputs.push("-stream_loop", "-1", "-i", args.backgroundPath);
    inputs.push("-i", args.foregroundPath);
    filters.push(
      [
        `[0:v]scale=${targetSize.w}:${targetSize.h}:force_original_aspect_ratio=increase`,
        `crop=${targetSize.w}:${targetSize.h}`,
        "setsar=1",
        "fps=30",
        `trim=duration=${args.foregroundDurationSec.toFixed(3)}`,
        "setpts=PTS-STARTPTS[bg]",
      ].join(","),
    );
    filters.push(
      `[1:v]scale=${Math.max(2, Math.round(targetSize.w * overlay.scale))}:-2,setsar=1,fps=30[fg]`,
    );
    filters.push(
      `[bg][fg]overlay=${overlayPositionExpr(overlay.position, overlay.marginPx)}${overlayEnableExpr(overlay, args.foregroundDurationSec)}:shortest=1[vmix]`,
    );
  } else {
    inputs.push("-i", args.foregroundPath);
    filters.push(
      [
        `[0:v]scale=${targetSize.w}:${targetSize.h}:force_original_aspect_ratio=increase`,
        `crop=${targetSize.w}:${targetSize.h}`,
        "setsar=1",
        "fps=30[vmix]",
      ].join(","),
    );
  }

  let videoLabel = "vmix";
  if (args.srtPath) {
    const marginV = await subtitleMarginVForOverlay({
      foregroundPath: args.foregroundPath,
      overlay,
      targetWidth: targetSize.w,
      targetHeight: targetSize.h,
      hasBackground: Boolean(args.backgroundPath),
    });
    filters.push(
      `[vmix]${buildSubtitlesFilterExpr(args.srtPath, buildSubtitleBurnInFilterOverrides(args.subtitleStyle, { MarginV: marginV }))}[vout]`,
    );
    videoLabel = "vout";
  }

  const fgIndex = args.backgroundPath ? 1 : 0;
  let audioMap: string | null = null;
  if (args.audioPath) {
    inputs.push("-i", args.audioPath);
    audioMap = `${args.backgroundPath ? 2 : 1}:a`;
  } else if (await clipHasAudio(args.foregroundPath)) {
    audioMap = `${fgIndex}:a`;
  }

  const ffArgs = [
    "-y",
    ...inputs,
    "-filter_complex",
    filters.join(";"),
    "-map",
    `[${videoLabel}]`,
  ];
  if (audioMap) {
    ffArgs.push("-map", audioMap, "-c:a", "aac", "-ar", "44100", "-ac", "2", "-b:a", "128k");
  } else {
    ffArgs.push("-an");
  }
  ffArgs.push(
    "-c:v",
    "libx264",
    "-preset",
    "fast",
    "-crf",
    "23",
    "-pix_fmt",
    "yuv420p",
    "-shortest",
    args.outPath,
  );

  await runFfmpeg(ffArgs);
}

/**
 * composite 渲染入口：`timeline.clips[0]` 为前景口播视频，
 * `timeline.composite` 描述背景 / 音轨 / 叠加位置 / 字幕。
 */
export async function runCompositeRender(args: {
  jobId: string;
  timeline: MediaTimelineV1;
  profile: RenderProfile;
  onProgress?: (pct: number, label: string) => void;
}): Promise<RenderFfmpegResult> {
  const composite = args.timeline.composite;
  if (!composite) throw new Error("缺少 composite 参数");
  const foreground = args.timeline.clips[0];
  if (!foreground) throw new Error("缺少前景视频");

  const tmp = await mkdtemp(join(tmpdir(), "media-composite-"));
  try {
    args.onProgress?.(5, "下载口播视频");
    const fgPath = join(tmp, "foreground.mp4");
    await fetchToFile(
      foreground.videoUrl,
      fgPath,
      MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
    );

    let bgPath: string | null = null;
    if (composite.backgroundUrl) {
      args.onProgress?.(20, "下载背景视频");
      bgPath = join(tmp, "background.mp4");
      await fetchToFile(
        composite.backgroundUrl,
        bgPath,
        MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
      );
    }

    let audioPath: string | null = null;
    if (composite.audioUrl) {
      args.onProgress?.(30, "下载口播音轨");
      audioPath = join(tmp, "voice.mp3");
      await fetchToFile(
        composite.audioUrl,
        audioPath,
        MEDIA_RENDER_MAX_SOURCE_BYTES_PER_CLIP,
      );
    }

    const fgDuration =
      foreground.durationSec && foreground.durationSec > 0
        ? foreground.durationSec
        : await ffprobeDurationSec(fgPath);
    if (fgDuration > MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC) {
      throw new Error(
        `成片时长 ${Math.round(fgDuration)}s 超过上限 ${MEDIA_RENDER_MAX_OUTPUT_DURATION_SEC}s`,
      );
    }

    // 有背景时按背景比例定画布（画中画铺底），否则按前景
    const sizeRef = bgPath
      ? await ffprobeVideoSize(bgPath)
      : await ffprobeVideoSize(fgPath);
    const targetSize = computeRenderTargetSize(
      [sizeRef],
      args.profile.video.scaleMode,
    );

    let srtContent: string | undefined;
    let srtPath: string | null = null;
    if (
      args.profile.subtitle.burnIn &&
      args.profile.subtitle.mode !== "none" &&
      composite.subtitleText?.trim()
    ) {
      args.onProgress?.(38, "生成字幕文件");
      srtContent = buildCompositeSrt(composite.subtitleText, fgDuration);
      if (srtContent.trim()) {
        srtPath = join(tmp, "subs.srt");
        await writeFile(srtPath, srtContent, "utf8");
        const style = args.profile.subtitle.style;
        const font = resolveSubtitleFontByKey(
          style?.fontKey ?? "heiti",
        );
        console.info(
          `[media-render] 烧录字幕字体 ${font.fontName} (${style?.fontKey ?? "heiti"}/${style?.sizeKey ?? "large"}) @ ${font.fontFile}`,
        );
      }
    }

    args.onProgress?.(
      45,
      bgPath ? "叠加数字人与背景" : "编码口播视频",
    );
    const outPath = join(tmp, "composite.mp4");
    await runCompositeFfmpeg({
      foregroundPath: fgPath,
      backgroundPath: bgPath,
      audioPath,
      overlay: composite.overlay,
      targetSize,
      foregroundDurationSec: fgDuration,
      srtPath,
      subtitleStyle: args.profile.subtitle.style,
      outPath,
    });

    args.onProgress?.(82, "编码完成，准备保存");
    const fastPath = join(tmp, "composite-faststart.mp4");
    const faststarted = await remuxMp4FaststartFromPath(outPath, fastPath);
    const uploadPath = faststarted ? fastPath : outPath;

    const outStat = await stat(uploadPath);
    const outMb = Math.max(1, Math.round(outStat.size / 1024 / 1024));
    args.onProgress?.(88, `保存成片（约 ${outMb}MB）`);

    const persisted = await persistMediaRenderLocalOutput(args.jobId, uploadPath);
    args.onProgress?.(89, "合成完成，可下载");

    return {
      localPath: persisted.path,
      bytesOut: persisted.bytesOut,
      totalDurationSec: fgDuration,
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

export async function runFfmpegMediaRender(args: {
  userId: string;
  jobId: string;
  timeline: MediaTimelineV1;
  profile: RenderProfile;
  onProgress?: (pct: number, label: string) => void;
}): Promise<RenderFfmpegResult> {
  const { timeline, profile, jobId } = args;
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
    const transitionSec =
      profile.transition.type === "xfade" ? profile.transition.durationSec : 0;
    const totalEstimate =
      transitionSec > 0 && probed.length > 1
        ? durations.reduce((a, b) => a + b, 0) -
          transitionSec * (probed.length - 1)
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

    const mixTts = resolveMixTtsEnabled(profile);
    if (mixTts) {
      const voicedPaths: string[] = [];
      let anyVoice = false;
      for (let i = 0; i < probed.length; i++) {
        const audioUrl = probed[i]!.audioUrl?.trim();
        args.onProgress?.(
          66 + Math.round((i / Math.max(probed.length, 1)) * 4),
          audioUrl
            ? `混入第 ${i + 1}/${probed.length} 镜口播音轨`
            : `补齐第 ${i + 1}/${probed.length} 镜静音轨`,
        );
        const voicedPath = join(tmp, `norm-voiced-${i}.mp4`);
        if (audioUrl) {
          anyVoice = true;
          await attachVoiceoverToNormalizedClip({
            videoPath: normPaths[i]!,
            audioUrl,
            durationSec: probed[i]!.durationSec,
            outPath: voicedPath,
          });
        } else {
          await attachSilentAudioToNormalizedClip({
            videoPath: normPaths[i]!,
            durationSec: probed[i]!.durationSec,
            outPath: voicedPath,
          });
        }
        voicedPaths.push(voicedPath);
      }
      if (anyVoice) {
        normPaths.splice(0, normPaths.length, ...voicedPaths);
      }
    }

    const srtFrames = timelineToSrtFrames(timeline, durations);
    let srtContent: string | undefined;
    if (profile.subtitle.mode === "script") {
      srtContent = buildMergedSrt(srtFrames, {
        transitionType: profile.transition.type,
        transitionSec,
      });
      if (profile.subtitle.burnIn && !srtContent?.trim()) {
        throw new Error(
          "未找到可烧录的分镜对白：请确认脚本表「对白」列已填写，或视频已连线文本/脚本节点后再试",
        );
      }
    } else if (profile.subtitle.mode === "asr" && profile.subtitle.burnIn) {
      const asrModelKey =
        profile.subtitle.asrModelKey?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL;
      const clipSegments: Array<
        Array<{ startMs: number; endMs: number; text: string }>
      > = [];
      for (let i = 0; i < timeline.clips.length; i++) {
        const clip = timeline.clips[i]!;
        args.onProgress?.(
          66 + Math.round((i / Math.max(timeline.clips.length, 1)) * 4),
          `识别第 ${i + 1}/${timeline.clips.length} 镜台词…`,
        );
        let segments: Array<{ startMs: number; endMs: number; text: string }> =
          [];
        try {
          segments = await transcribeClipViaGateway({
            userId: args.userId,
            fileUrl: clip.videoUrl,
            modelKey: asrModelKey,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (/Gateway API Key|未关联 Gateway/i.test(msg)) {
            throw e;
          }
          segments = [];
        }
        if (segments.length === 0 && clip.subtitle?.trim()) {
          const durMs = Math.max(
            500,
            Math.round((durations[i] ?? 3) * 1000),
          );
          segments = [
            {
              startMs: 0,
              endMs: durMs,
              text: clip.subtitle.trim(),
            },
          ];
        }
        clipSegments.push(segments);
      }
      srtContent = buildAsrSubtitleSrt(clipSegments, durations, {
        transitionType: profile.transition.type,
        transitionSec,
      });
    }
    let srtPath: string | undefined;
    if (srtContent?.trim()) {
      args.onProgress?.(68, "生成字幕文件");
      srtPath = join(tmp, "subs.srt");
      await writeFile(srtPath, srtContent, "utf8");
      if (profile.subtitle.burnIn) {
        const style = profile.subtitle.style;
        const font = resolveSubtitleFontByKey(style?.fontKey ?? "heiti");
        console.info(
          `[media-render] 烧录字幕字体 ${font.fontName} (${style?.fontKey ?? "heiti"}/${style?.sizeKey ?? "large"}) @ ${font.fontFile}`,
        );
      }
    }

    const outPath = join(tmp, "merged.mp4");
    const willBurnSubs = Boolean(srtPath?.trim() && profile.subtitle.burnIn);
    const xfadeLabel =
      profile.transition.type === "xfade" && normPaths.length > 1
        ? willBurnSubs
          ? "合并转场并烧录字幕"
          : "合并转场"
        : willBurnSubs
          ? "拼接镜头并烧录字幕"
          : "拼接镜头";
    args.onProgress?.(72, xfadeLabel);
    await renderXfade(normPaths, durations, profile, outPath, srtPath);
    args.onProgress?.(85, "编码完成，准备保存");

    const fastPath = join(tmp, "merged-faststart.mp4");
    const faststarted = await remuxMp4FaststartFromPath(outPath, fastPath);
    const uploadPath = faststarted ? fastPath : outPath;

    const outStat = await stat(uploadPath);
    const outMb = Math.max(1, Math.round(outStat.size / 1024 / 1024));
    args.onProgress?.(88, `保存成片（约 ${outMb}MB）`);

    const persisted = await persistMediaRenderLocalOutput(jobId, uploadPath);
    args.onProgress?.(89, "剪辑完成，可下载");

    return {
      localPath: persisted.path,
      bytesOut: persisted.bytesOut,
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
