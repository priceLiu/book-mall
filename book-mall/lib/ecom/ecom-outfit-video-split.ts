import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { CanvasChatContentPart } from "@/lib/canvas/providers/types";
import { uploadCanvasUserBuffer } from "@/lib/canvas/canvas-oss";
import {
  extractVideoFirstFrameJpegFromPath,
  remuxMp4FaststartFromPath,
} from "@/lib/canvas/video-poster-ffmpeg";
import { assertStoryLlmVideoUnderstandingModel } from "@/lib/canvas/story-llm-vision-models";
import { ecomClientPage } from "@/lib/ecom/ecom-tool-keys";
import { ECOM_OUTFIT_VIDEO_TOOL_KEY } from "@/lib/ecom/ecom-outfit-video-types";
import {
  applyOutfitShotAnalysisToScene,
  buildOutfitSplitSystemPrompt,
  buildOutfitSplitBatchEnrichUserContent,
  buildOutfitSplitRetryEnrichUserContent,
  DEFAULT_OUTFIT_SPLIT_USER_PROMPT,
  listOutfitSplitEnrichRetrySceneIds,
  mergeOutfitSplitEnrichMaps,
  parseOutfitSplitBatchEnrichFromLlm,
  type OutfitShotAnalysis,
} from "@/lib/ecom/video-workflow/templates/outfit-v1/shot-analysis";
import type { OutfitSplitProgress } from "@/lib/ecom/ecom-outfit-video-types";
import type { SceneShot } from "@/lib/ecom/video-workflow/shot-spine";
import { collectEcomGwChatStreamText } from "@/lib/gateway/ecom-gw-chat-stream-collect";
import { assertFfmpegForMediaRender } from "@/lib/media/ffmpeg-preflight";
import { runFfmpeg, runFfprobe } from "@/lib/media/ffmpeg-exec";
import { ffprobeDurationSec } from "@/lib/media/render-ffmpeg";

const MAX_REFERENCE_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_SCENES = 20;
const SCENE_DETECT_THRESHOLD = 0.32;

export type OutfitSplitConfig = {
  minSceneDurationSec: number;
  maxSceneDurationSec: number;
};

export type OutfitPhysicalSegment = {
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
};

export type OutfitSplitSceneAsset = {
  sceneId: string;
  index: number;
  segment: OutfitPhysicalSegment;
  previewImageUrl: string;
  referenceClipUrl: string;
  keypointsUrl: string;
  shotAnalysis: OutfitShotAnalysis | null;
};

async function fetchVideoToFile(url: string, dest: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(180_000) });
  if (!res.ok) {
    throw new Error(`下载参考视频失败 HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > MAX_REFERENCE_VIDEO_BYTES) {
    throw new Error(
      `参考视频过大（>${Math.round(MAX_REFERENCE_VIDEO_BYTES / 1024 / 1024)}MB），请压缩后重试`,
    );
  }
  if (buf.byteLength < 1024) {
    throw new Error("参考视频文件无效或过短");
  }
  await writeFile(dest, buf);
}

/** ffmpeg scene 滤镜 · 检测硬切时间戳（秒） */
export async function detectSceneCutTimestamps(videoPath: string): Promise<number[]> {
  return new Promise((resolve) => {
    const args = [
      "-hide_banner",
      "-loglevel",
      "info",
      "-i",
      videoPath,
      "-filter:v",
      `select='gt(scene,${SCENE_DETECT_THRESHOLD})',showinfo`,
      "-an",
      "-f",
      "null",
      "-",
    ];
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", () => resolve([]));
    child.on("close", () => {
      const times = new Set<number>();
      const re = /pts_time:([0-9.]+)/g;
      let match: RegExpExecArray | null;
      while ((match = re.exec(stderr)) !== null) {
        const sec = Number.parseFloat(match[1] ?? "");
        if (Number.isFinite(sec) && sec > 0.05) {
          times.add(Math.round(sec * 1000) / 1000);
        }
      }
      resolve([...times].sort((a, b) => a - b));
    });
  });
}

/** 将切点约束为 PRD 2–4s 物理分镜段 */
export function buildPhysicalSegmentsFromCuts(
  totalDurationSec: number,
  cutTimestamps: number[],
  config: OutfitSplitConfig,
): OutfitPhysicalSegment[] {
  const minSec = Math.max(1, config.minSceneDurationSec);
  const maxSec = Math.max(minSec, config.maxSceneDurationSec);
  const duration = Math.max(0.1, totalDurationSec);
  if (duration <= maxSec) {
    return [{ startTimeSec: 0, endTimeSec: duration, durationSec: duration }];
  }

  const boundaries = [0, ...cutTimestamps.filter((t) => t > 0 && t < duration), duration];
  const unique: number[] = [];
  for (const t of boundaries) {
    const rounded = Math.round(t * 1000) / 1000;
    if (!unique.length || rounded - unique[unique.length - 1]! > 0.05) {
      unique.push(rounded);
    }
  }
  if (unique[unique.length - 1]! < duration - 0.05) unique.push(duration);

  const raw: OutfitPhysicalSegment[] = [];
  for (let i = 0; i < unique.length - 1; i++) {
    const start = unique[i]!;
    const end = unique[i + 1]!;
    if (end - start >= 0.5) {
      raw.push({
        startTimeSec: start,
        endTimeSec: end,
        durationSec: Math.round((end - start) * 1000) / 1000,
      });
    }
  }

  const merged: OutfitPhysicalSegment[] = [];
  for (const seg of raw) {
    if (seg.durationSec >= minSec || merged.length === 0) {
      merged.push({ ...seg });
      continue;
    }
    const prev = merged[merged.length - 1]!;
    prev.endTimeSec = seg.endTimeSec;
    prev.durationSec = Math.round((prev.endTimeSec - prev.startTimeSec) * 1000) / 1000;
  }

  const splitLong = (seg: OutfitPhysicalSegment): OutfitPhysicalSegment[] => {
    if (seg.durationSec <= maxSec) return [seg];
    const parts: OutfitPhysicalSegment[] = [];
    let cursor = seg.startTimeSec;
    while (cursor < seg.endTimeSec - 0.05) {
      const end = Math.min(seg.endTimeSec, cursor + maxSec);
      parts.push({
        startTimeSec: cursor,
        endTimeSec: end,
        durationSec: Math.round((end - cursor) * 1000) / 1000,
      });
      cursor = end;
    }
    return parts;
  };

  const normalized = merged.flatMap(splitLong).filter((s) => s.durationSec >= 0.5);
  if (normalized.length > MAX_SCENES) {
    return normalized.slice(0, MAX_SCENES);
  }
  if (normalized.length === 0) {
    const chunk = Math.min(maxSec, Math.max(minSec, 3));
    const parts: OutfitPhysicalSegment[] = [];
    for (let t = 0; t < duration - 0.05; t += chunk) {
      const end = Math.min(duration, t + chunk);
      parts.push({
        startTimeSec: t,
        endTimeSec: end,
        durationSec: Math.round((end - t) * 1000) / 1000,
      });
      if (parts.length >= MAX_SCENES) break;
    }
    return parts.length > 0 ? parts : [{ startTimeSec: 0, endTimeSec: duration, durationSec: duration }];
  }
  return normalized;
}

async function extractVideoFrameJpegAtSec(
  videoPath: string,
  timeSec: number,
): Promise<Buffer | null> {
  let dir: string | null = null;
  try {
    dir = await mkdtemp(join(tmpdir(), "outfit-frame-"));
    const output = join(dir, "frame.jpg");
    await runFfmpeg(
      [
        "-ss",
        String(Math.max(0, timeSec)),
        "-i",
        videoPath,
        "-frames:v",
        "1",
        "-q:v",
        "4",
        "-y",
        output,
      ],
      { timeoutMs: 120_000 },
    );
    const frame = await readFile(output);
    return frame.byteLength > 0 ? frame : null;
  } catch {
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function extractClipMp4(args: {
  sourcePath: string;
  startSec: number;
  durationSec: number;
  outputPath: string;
}): Promise<void> {
  await runFfmpeg(
    [
      "-ss",
      String(Math.max(0, args.startSec)),
      "-i",
      args.sourcePath,
      "-t",
      String(Math.max(0.2, args.durationSec)),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      "-y",
      args.outputPath,
    ],
    { timeoutMs: 300_000 },
  );
}

async function probeVideoFps(videoPath: string): Promise<number> {
  try {
    const stdout = await runFfprobe([
      "-v",
      "error",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=r_frame_rate",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ]);
    const raw = stdout.trim();
    if (raw.includes("/")) {
      const [n, d] = raw.split("/").map((x) => Number.parseFloat(x));
      if (Number.isFinite(n) && Number.isFinite(d) && d > 0) {
        return Math.round((n / d) * 100) / 100;
      }
    }
    const n = Number.parseFloat(raw);
    if (Number.isFinite(n) && n > 0) return n;
  } catch {
    /* fallback */
  }
  return 30;
}

function buildKeypointsPayload(args: {
  sceneId: string;
  segment: OutfitPhysicalSegment;
  fps: number;
  referenceClipUrl: string;
  shotAnalysis?: OutfitShotAnalysis | null;
}): Record<string, unknown> {
  const frameCount = Math.max(1, Math.round(args.segment.durationSec * args.fps));
  const analysis = args.shotAnalysis;
  return {
    schemaVersion: "ecom-outfit-keypoints/v1",
    sceneId: args.sceneId,
    startTimeSec: args.segment.startTimeSec,
    endTimeSec: args.segment.endTimeSec,
    durationSec: args.segment.durationSec,
    fps: args.fps,
    frameCount,
    referenceClipUrl: args.referenceClipUrl,
    motionSource: "reference_clip",
    cameraType: "from_reference",
    motionType: "from_reference",
    shotAnalysis: analysis
      ? {
          characterAction: analysis.characterAction,
          cameraMove: analysis.cameraMove,
          lightingSetup: analysis.lightingSetup,
          sceneBackground: analysis.sceneBackground,
          toneContrast: analysis.toneContrast,
        }
      : undefined,
    keyframeTimesSec: [
      args.segment.startTimeSec,
      args.segment.startTimeSec + args.segment.durationSec / 2,
      args.segment.endTimeSec,
    ],
  };
}

function splitProgressNow(
  phase: OutfitSplitProgress["phase"],
  label: string,
  step?: number,
  totalSteps?: number,
): OutfitSplitProgress {
  return {
    phase,
    label,
    step,
    totalSteps,
    updatedAt: new Date().toISOString(),
  };
}

const OUTFIT_SPLIT_ENRICH_MAX_RETRIES = 2;

async function callOutfitSplitEnrichLlm(opts: {
  userId: string;
  projectId: string;
  splitModelKey: string;
  systemPrompt: string;
  userContent: CanvasChatContentPart[];
  onStreamChunk?: (accumulated: string) => void | Promise<void>;
}): Promise<string> {
  return collectEcomGwChatStreamText(opts.userId, {
    modelKey: opts.splitModelKey,
    messages: [
      { role: "system", content: opts.systemPrompt },
      { role: "user", content: opts.userContent },
    ],
    clientPage: ecomClientPage(opts.userId, opts.projectId, ECOM_OUTFIT_VIDEO_TOOL_KEY),
    onChunk: opts.onStreamChunk,
  });
}

async function enrichAllScenesWithShotAnalysis(opts: {
  userId: string;
  projectId: string;
  splitModelKey: string;
  systemPrompt: string;
  userPromptBase: string;
  segments: Array<{
    sceneId: string;
    startTimeSec: number;
    endTimeSec: number;
    durationSec: number;
    previewImageUrl?: string;
  }>;
  onStreamChunk?: (accumulated: string) => void | Promise<void>;
}): Promise<Map<string, OutfitShotAnalysis>> {
  assertStoryLlmVideoUnderstandingModel(opts.splitModelKey, "穿搭拆镜");
  const expectedIds = opts.segments.map((s) => s.sceneId);

  try {
    const raw = await callOutfitSplitEnrichLlm({
      userId: opts.userId,
      projectId: opts.projectId,
      splitModelKey: opts.splitModelKey,
      systemPrompt: opts.systemPrompt,
      userContent: buildOutfitSplitBatchEnrichUserContent(opts.segments, opts.userPromptBase),
      onStreamChunk: opts.onStreamChunk,
    });
    let analysisBySceneId = parseOutfitSplitBatchEnrichFromLlm(raw);

    for (let attempt = 0; attempt < OUTFIT_SPLIT_ENRICH_MAX_RETRIES; attempt++) {
      const retryIds = listOutfitSplitEnrichRetrySceneIds(analysisBySceneId, expectedIds);
      if (retryIds.length === 0) break;

      const retrySegments = opts.segments.filter((s) => retryIds.includes(s.sceneId));
      if (retrySegments.length === 0) break;

      const retryRaw = await callOutfitSplitEnrichLlm({
        userId: opts.userId,
        projectId: opts.projectId,
        splitModelKey: opts.splitModelKey,
        systemPrompt: opts.systemPrompt,
        userContent: buildOutfitSplitRetryEnrichUserContent(retrySegments, opts.userPromptBase),
        onStreamChunk: opts.onStreamChunk,
      });
      analysisBySceneId = mergeOutfitSplitEnrichMaps(
        analysisBySceneId,
        parseOutfitSplitBatchEnrichFromLlm(retryRaw),
      );
    }

    return analysisBySceneId;
  } catch {
    return new Map();
  }
}

export async function splitOutfitReferenceVideoPhysical(opts: {
  userId: string;
  projectId: string;
  referenceVideoUrl: string;
  splitConfig: OutfitSplitConfig;
  splitModelKey?: string;
  splitSystemPrompt?: string;
  splitUserPrompt?: string;
  enrichWithLlm?: boolean;
  onProgress?: (progress: OutfitSplitProgress) => void | Promise<void>;
  onStreamChunk?: (accumulated: string) => void | Promise<void>;
}): Promise<{
  sceneList: SceneShot[];
  splitSceneSource: "ffmpeg_v1";
  totalDurationSec: number;
}> {
  await assertFfmpegForMediaRender();

  const report = async (progress: OutfitSplitProgress) => {
    await opts.onProgress?.(progress);
  };

  let workDir: string | null = null;
  try {
    await report(splitProgressNow("prepare", "下载参考视频…"));
    workDir = await mkdtemp(join(tmpdir(), "outfit-split-"));
    const sourcePath = join(workDir, "source.mp4");
    await fetchVideoToFile(opts.referenceVideoUrl.trim(), sourcePath);

    const fastPath = join(workDir, "source-fast.mp4");
    const fastOk = await remuxMp4FaststartFromPath(sourcePath, fastPath);
    const inputPath = fastOk ? fastPath : sourcePath;

    const totalDurationSec = await ffprobeDurationSec(inputPath);
    if (totalDurationSec < 1) {
      throw new Error("参考视频过短，请上传至少 1 秒的穿搭视频");
    }
    if (totalDurationSec > 120) {
      throw new Error("参考视频过长，请先裁剪至 120 秒以内");
    }

    await report(splitProgressNow("detect", "检测镜头切点…"));
    const cutTimes = await detectSceneCutTimestamps(inputPath);
    const segments = buildPhysicalSegmentsFromCuts(totalDurationSec, cutTimes, opts.splitConfig);
    if (segments.length === 0) {
      throw new Error("未能从参考视频切出有效分镜");
    }

    const fps = await probeVideoFps(inputPath);
    const assets: OutfitSplitSceneAsset[] = [];
    const segmentMeta: Array<{
      sceneId: string;
      startTimeSec: number;
      endTimeSec: number;
      durationSec: number;
      previewImageUrl: string;
    }> = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const sceneId = `s${i + 1}`;
      await report(
        splitProgressNow(
          "cut",
          `切分镜头 ${i + 1}/${segments.length}…`,
          i + 1,
          segments.length,
        ),
      );
      const clipPath = join(workDir, `${sceneId}.mp4`);
      await extractClipMp4({
        sourcePath: inputPath,
        startSec: segment.startTimeSec,
        durationSec: segment.durationSec,
        outputPath: clipPath,
      });

      const clipBuf = await readFile(clipPath);
      const referenceClipUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "mp4",
        buf: clipBuf,
        contentType: "video/mp4",
      });

      const midSec = segment.startTimeSec + segment.durationSec / 2;
      let previewBuf =
        (await extractVideoFrameJpegAtSec(clipPath, segment.durationSec / 2)) ??
        (await extractVideoFirstFrameJpegFromPath(clipPath));
      if (!previewBuf) {
        previewBuf = await extractVideoFrameJpegAtSec(inputPath, midSec);
      }
      if (!previewBuf) {
        throw new Error(`分镜 ${i + 1} 预览帧提取失败`);
      }

      const previewImageUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "jpg",
        buf: previewBuf,
        contentType: "image/jpeg",
      });

      segmentMeta.push({
        sceneId,
        startTimeSec: segment.startTimeSec,
        endTimeSec: segment.endTimeSec,
        durationSec: segment.durationSec,
        previewImageUrl,
      });

      assets.push({
        sceneId,
        index: i + 1,
        segment,
        previewImageUrl,
        referenceClipUrl,
        keypointsUrl: "",
        shotAnalysis: null,
      });
    }

    let analysisBySceneId = new Map<string, OutfitShotAnalysis>();
    if (opts.enrichWithLlm !== false && opts.splitModelKey?.trim()) {
      await report(
        splitProgressNow(
          "analyze",
          `视觉理解分析（${segments.length} 镜关键帧 · 一次返回）…`,
        ),
      );
      analysisBySceneId = await enrichAllScenesWithShotAnalysis({
        userId: opts.userId,
        projectId: opts.projectId,
        splitModelKey: opts.splitModelKey.trim(),
        systemPrompt: opts.splitSystemPrompt ?? buildOutfitSplitSystemPrompt(),
        userPromptBase: opts.splitUserPrompt?.trim() || DEFAULT_OUTFIT_SPLIT_USER_PROMPT,
        segments: segmentMeta,
        onStreamChunk: opts.onStreamChunk,
      });
    }

    await report(splitProgressNow("finalize", "写入分镜与关键点…"));

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i]!;
      const shotAnalysis = analysisBySceneId.get(asset.sceneId) ?? null;
      const keypointsJson = buildKeypointsPayload({
        sceneId: asset.sceneId,
        segment: asset.segment,
        fps,
        referenceClipUrl: asset.referenceClipUrl,
        shotAnalysis,
      });
      const keypointsUrl = await uploadCanvasUserBuffer({
        userId: opts.userId,
        ext: "json",
        buf: Buffer.from(JSON.stringify(keypointsJson), "utf8"),
        contentType: "application/json",
      });
      assets[i] = { ...asset, keypointsUrl, shotAnalysis };
    }

    const sceneList: SceneShot[] = assets.map((a) => {
      const base: SceneShot = {
        sceneId: a.sceneId,
        index: a.index,
        startTimeSec: a.segment.startTimeSec,
        endTimeSec: a.segment.endTimeSec,
        durationSec: a.segment.durationSec,
        cameraType: "from_reference",
        motionType: "from_reference",
        previewImageUrl: a.previewImageUrl,
        keypointsUrl: a.keypointsUrl,
        referenceClipUrl: a.referenceClipUrl,
        status: "pending",
      };
      return a.shotAnalysis ? applyOutfitShotAnalysisToScene(base, a.shotAnalysis) : base;
    });

    return { sceneList, splitSceneSource: "ffmpeg_v1", totalDurationSec };
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}
