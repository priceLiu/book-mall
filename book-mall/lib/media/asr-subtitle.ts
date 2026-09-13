import { createHash } from "crypto";

import {
  formatSrtTime,
  type SubtitleTimingOptions,
  allocateTimedCuesByCharWeight,
  computeSubtitleCueTimes,
  normalizeSubtitleBurnInText,
  splitSubtitleTextIntoBurnInParts,
  stripSubtitleSpeakerPrefix,
} from "@/lib/media/subtitle-burn-in";
import {
  QWEN3_ASR_FLASH_FILETRANS_MODEL,
  isDashscopeAsrNoSpeechOutcome,
  type DashscopeAsrSentence,
} from "@/lib/gateway/dashscope-client";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import { gatewayV1AsrTranscribe, gatewayV1ClientMeta } from "@/lib/gateway/gateway-v1-http-client";
import { MEDIA_RENDER_ASR_CLIENT_PAGE } from "@/lib/media/media-render-credits";
import { prisma } from "@/lib/prisma";

export type AsrSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type ClipAsrResult = {
  clipIndex: number;
  segments: AsrSegment[];
};

const MEDIA_RENDER_ASR_CACHE_TTL_MS = 24 * 3600_000;

/** 成片时间线 ASR 去重键：同分镜 URL + 合并时长 + 转场 → 复用识别结果 */
export function buildMediaRenderAsrCacheKey(args: {
  clipVideoUrls: string[];
  mergeDurationsSec: number[];
  modelKey: string;
  transitionType: string;
  transitionSec: number;
}): string {
  const payload = JSON.stringify({
    v: 1,
    urls: args.clipVideoUrls,
    durs: args.mergeDurationsSec.map((d) => Math.round(d * 1000) / 1000),
    model: args.modelKey.trim().toLowerCase(),
    tx: args.transitionType,
    txSec: Math.round(args.transitionSec * 1000) / 1000,
  });
  return createHash("sha256").update(payload).digest("hex");
}

function readSegmentsFromLogResult(resultSummary: unknown): AsrSegment[] | null {
  if (!resultSummary || typeof resultSummary !== "object") return null;
  const segments = (resultSummary as { segments?: unknown }).segments;
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const out: AsrSegment[] = [];
  for (const item of segments) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const text = typeof rec.text === "string" ? rec.text.trim() : "";
    const startMs = typeof rec.startMs === "number" ? rec.startMs : NaN;
    const endMs = typeof rec.endMs === "number" ? rec.endMs : NaN;
    if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs)) continue;
    out.push({ startMs, endMs, text });
  }
  return out.length > 0 ? out : null;
}

/** 查近期已成功 ASR 日志，避免孤儿恢复/重复导出再次调厂商 */
export async function findCachedMediaRenderAsrSegments(
  cacheKey: string,
): Promise<AsrSegment[] | null> {
  const since = new Date(Date.now() - MEDIA_RENDER_ASR_CACHE_TTL_MS);
  const row = await prisma.gatewayRequestLog.findFirst({
    where: {
      clientPage: MEDIA_RENDER_ASR_CLIENT_PAGE,
      status: "SUCCEEDED",
      submittedAt: { gte: since },
      inputSummary: {
        path: ["input", "cacheKey"],
        equals: cacheKey,
      },
    },
    orderBy: { submittedAt: "desc" },
    select: { resultSummary: true },
  });
  return readSegmentsFromLogResult(row?.resultSummary);
}

/** 自动成片：整段时间线一次 ASR（含 24h 内 cacheKey 缓存） */
export async function transcribeMediaTimelineViaGateway(args: {
  userId: string;
  fileUrl: string;
  modelKey?: string;
  cacheKey: string;
}): Promise<AsrSegment[]> {
  const cached = await findCachedMediaRenderAsrSegments(args.cacheKey);
  if (cached) return cached;

  const auth = await resolveGatewayAuthForBookUser(args.userId);
  if (!auth?.id) {
    throw new Error("未关联 Gateway API Key，无法使用语音识别烧字幕");
  }
  try {
    const { segments } = await gatewayV1AsrTranscribe({
      apiKeyId: auth.id,
      body: {
        fileUrl: args.fileUrl,
        modelKey: args.modelKey?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL,
        cacheKey: args.cacheKey,
      },
      meta: gatewayV1ClientMeta("CANVAS", {
        bookUserId: args.userId,
        clientPage: MEDIA_RENDER_ASR_CLIENT_PAGE,
      }),
    });
    return segments;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isDashscopeAsrNoSpeechOutcome(undefined, msg, msg)) {
      return [];
    }
    throw e;
  }
}

/** @deprecated 保留给旧调用方；新成片请用 transcribeMediaTimelineViaGateway */
export async function transcribeClipViaGateway(args: {
  userId: string;
  fileUrl: string;
  modelKey?: string;
}): Promise<ClipAsrResult["segments"]> {
  const auth = await resolveGatewayAuthForBookUser(args.userId);
  if (!auth?.id) {
    throw new Error("未关联 Gateway API Key，无法使用语音识别烧字幕");
  }
  try {
    const { segments } = await gatewayV1AsrTranscribe({
      apiKeyId: auth.id,
      body: {
        fileUrl: args.fileUrl,
        modelKey: args.modelKey?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL,
      },
      meta: gatewayV1ClientMeta("CANVAS", {
        bookUserId: args.userId,
        clientPage: MEDIA_RENDER_ASR_CLIENT_PAGE,
      }),
    });
    return segments;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isDashscopeAsrNoSpeechOutcome(undefined, msg, msg)) {
      return [];
    }
    throw e;
  }
}

/**
 * 将 ASR 句级时间戳展开为烧录短 cue：保留厂商 begin/end，句内再按字数切短。
 */
export function expandAsrSegmentToBurnInCues(
  seg: AsrSegment,
  clipStartSec: number,
): Array<{ startSec: number; endSec: number; text: string }> {
  const text = normalizeSubtitleBurnInText(
    stripSubtitleSpeakerPrefix(seg.text),
  );
  if (!text) return [];
  const startSec = clipStartSec + Math.max(0, seg.startMs) / 1000;
  const endSec = clipStartSec + Math.max(seg.endMs, seg.startMs + 300) / 1000;
  const safeEnd = endSec > startSec ? endSec : startSec + 0.3;
  const parts = splitSubtitleTextIntoBurnInParts(text);
  return allocateTimedCuesByCharWeight(parts, startSec, safeEnd);
}

/** 已合并时间线上的 ASR 结果 → SRT（时间戳相对成片 0 点） */
export function buildAsrSubtitleSrtFromGlobalSegments(
  segments: AsrSegment[],
): string {
  const blocks: string[] = [];
  let cueIndex = 0;
  for (const seg of segments) {
    for (const cue of expandAsrSegmentToBurnInCues(seg, 0)) {
      cueIndex += 1;
      blocks.push(
        String(cueIndex),
        `${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}`,
        cue.text,
        "",
      );
    }
  }
  return blocks.join("\n");
}

export function buildAsrSubtitleSrt(
  clipSegments: AsrSegment[][],
  durationsSec: number[],
  timing?: SubtitleTimingOptions,
): string {
  const cues = computeSubtitleCueTimes(durationsSec, timing);
  const blocks: string[] = [];
  let cueIndex = 0;

  for (let clipIdx = 0; clipIdx < clipSegments.length; clipIdx++) {
    const clipStartSec = cues[clipIdx]?.startSec ?? 0;
    const segments = clipSegments[clipIdx] ?? [];
    for (const seg of segments) {
      for (const cue of expandAsrSegmentToBurnInCues(seg, clipStartSec)) {
        cueIndex += 1;
        blocks.push(
          String(cueIndex),
          `${formatSrtTime(cue.startSec)} --> ${formatSrtTime(cue.endSec)}`,
          cue.text,
          "",
        );
      }
    }
  }

  return blocks.join("\n");
}

/** ASR 无结果时，按镜回退到分镜表对白 */
export function buildAsrSubtitleSrtFromClipScriptFallback(args: {
  clipSubtitles: Array<string | undefined>;
  mergeDurationsSec: number[];
  timing?: SubtitleTimingOptions;
}): string {
  const clipSegments = args.clipSubtitles.map((subtitle, i) => {
    const text = subtitle?.trim();
    if (!text) return [];
    const durMs = Math.max(
      500,
      Math.round((args.mergeDurationsSec[i] ?? 3) * 1000),
    );
    return [{ startMs: 0, endMs: durMs, text }];
  });
  return buildAsrSubtitleSrt(clipSegments, args.mergeDurationsSec, args.timing);
}

/** @internal test helper */
export function mapDashscopeSentencesToSegments(
  sentences: DashscopeAsrSentence[],
): AsrSegment[] {
  return sentences.map((s) => ({
    startMs: s.beginMs,
    endMs: s.endMs,
    text: s.text,
  }));
}
