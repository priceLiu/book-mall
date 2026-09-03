import { isDashscopeAsrNoSpeechOutcome } from "@/lib/gateway/dashscope-client";
import { GatewayRequiredError } from "@/lib/gateway/book-gateway-link";
import { ecomGwAsrTranscribe } from "@/lib/gateway/ecom-tool-gateway-client";
import type { MediaDecomposePatch } from "@/lib/ecom/ecom-media-decompose-structured";

export const MEDIA_DECOMPOSE_NO_SPEECH = "【无任何人声】";
export const MEDIA_DECOMPOSE_NO_TALENT = "【无出镜模特】";

export type MediaDecomposeAsrSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type MediaDecomposeAsrBundle = {
  segments: MediaDecomposeAsrSegment[];
  fullTranscript: string;
  first3sLines: string;
  failed?: boolean;
  failMessage?: string;
};

function cleanAsrText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function joinAsrTexts(parts: string[]): string {
  return parts.map(cleanAsrText).filter(Boolean).join("");
}

export function parseShotTimeWindowMs(
  duration: string,
  fallbackStartMs: number,
): { startMs: number; endMs: number } {
  const t = duration.replace(/[‑–—]/g, "-").trim();
  const range = t.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*s?/i);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    const startSec = Math.min(a, b);
    const endSec = Math.max(a, b);
    const startMs = Math.round(startSec * 1000);
    const endMs = Math.round(endSec * 1000);
    return { startMs, endMs: endMs > startMs ? endMs : startMs + 300 };
  }
  const single = t.match(/(\d+(?:\.\d+)?)\s*s?/i);
  const durSec = single ? Number(single[1]) : 5;
  const startMs = Math.max(0, fallbackStartMs);
  const endMs = startMs + Math.round(Math.max(0.3, durSec) * 1000);
  return { startMs, endMs };
}

export function resolveStoryboardTimeWindows(
  rows: Array<{ duration?: string }>,
): Array<{ startMs: number; endMs: number }> {
  let cursor = 0;
  return rows.map((row) => {
    const window = parseShotTimeWindowMs(row.duration ?? "", cursor);
    cursor = window.endMs;
    return window;
  });
}

export function collectAsrTextInWindow(
  segments: MediaDecomposeAsrSegment[],
  startMs: number,
  endMs: number,
): string {
  const hit = segments
    .filter((seg) => seg.endMs > startMs && seg.startMs < endMs)
    .map((seg) => seg.text);
  return joinAsrTexts(hit);
}

/** 每句 ASR 只归属一镜（中心点所在时段，否则取最大重叠），避免跨镜整句重复 */
export function assignAsrVoiceoverToShots(
  segments: MediaDecomposeAsrSegment[],
  windows: Array<{ startMs: number; endMs: number }>,
): string[] {
  const byShot: string[][] = windows.map(() => []);
  for (const seg of segments) {
    const center = (seg.startMs + seg.endMs) / 2;
    let idx = windows.findIndex(
      (w, i) =>
        center >= w.startMs &&
        (center < w.endMs || (i === windows.length - 1 && center <= w.endMs)),
    );
    if (idx < 0) {
      let bestOverlap = 0;
      for (let i = 0; i < windows.length; i++) {
        const w = windows[i]!;
        const overlap = Math.min(seg.endMs, w.endMs) - Math.max(seg.startMs, w.startMs);
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          idx = i;
        }
      }
      if (idx < 0 || bestOverlap <= 0) continue;
    }
    byShot[idx]!.push(seg.text);
  }
  return byShot.map((parts) => joinAsrTexts(parts));
}

export function buildMediaDecomposeAsrBundle(
  segments: MediaDecomposeAsrSegment[],
): MediaDecomposeAsrBundle {
  const cleaned = segments
    .map((seg) => ({
      startMs: seg.startMs,
      endMs: seg.endMs,
      text: cleanAsrText(seg.text),
    }))
    .filter((seg) => seg.text);
  const fullTranscript = joinAsrTexts(cleaned.map((s) => s.text));
  const first3sLines = collectAsrTextInWindow(cleaned, 0, 3000);
  return {
    segments: cleaned,
    fullTranscript: fullTranscript || MEDIA_DECOMPOSE_NO_SPEECH,
    first3sLines: first3sLines || MEDIA_DECOMPOSE_NO_SPEECH,
  };
}

export function formatMediaDecomposeAsrPromptBlock(bundle: MediaDecomposeAsrBundle): string {
  if (bundle.failed) {
    return `【ASR 转写失败】${bundle.failMessage ?? "未知错误"}。openingHook.first3sLines / fullTranscript / 各镜 voiceover 仍须按契约输出；听不清时 openingHook.first3sLines 与 fullTranscript 填 ${MEDIA_DECOMPOSE_NO_SPEECH}。`;
  }
  const timeline = bundle.segments
    .map((s) => `${(s.startMs / 1000).toFixed(1)}-${(s.endMs / 1000).toFixed(1)}s ${s.text}`)
    .join("\n");
  return `【权威台词时间轴 · ASR · 禁止改写】
- 前三秒台词：${bundle.first3sLines}
- 完整台词全文：${bundle.fullTranscript}
- 带时间戳（按镜切 voiceover 必须对齐）：
${timeline || MEDIA_DECOMPOSE_NO_SPEECH}`;
}

export function applyMediaDecomposeAsrOverlay(
  patch: MediaDecomposePatch,
  bundle: MediaDecomposeAsrBundle,
): MediaDecomposePatch {
  if (patch.mediaType !== "video" || bundle.failed) return patch;
  const windows = resolveStoryboardTimeWindows(patch.storyboardTable);
  const voiceovers = assignAsrVoiceoverToShots(bundle.segments, windows);
  return {
    ...patch,
    openingHook: {
      firstFrame: patch.openingHook.firstFrame,
      first3sLines: bundle.first3sLines,
    },
    fullTranscript: bundle.fullTranscript,
    storyboardTable: patch.storyboardTable.map((row, i) => ({
      ...row,
      voiceover: voiceovers[i] ?? "",
    })),
  };
}

export async function transcribeMediaDecomposeVideo(opts: {
  userId: string;
  fileUrl: string;
  clientPage: string;
}): Promise<MediaDecomposeAsrBundle> {
  try {
    const { segments } = await ecomGwAsrTranscribe(opts.userId, {
      fileUrl: opts.fileUrl,
      clientPage: opts.clientPage,
    });
    return buildMediaDecomposeAsrBundle(segments);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isDashscopeAsrNoSpeechOutcome(undefined, msg, msg)) {
      return buildMediaDecomposeAsrBundle([]);
    }
    if (e instanceof GatewayRequiredError) throw e;
    console.error("[media-decompose asr]", msg);
    return {
      segments: [],
      fullTranscript: MEDIA_DECOMPOSE_NO_SPEECH,
      first3sLines: MEDIA_DECOMPOSE_NO_SPEECH,
      failed: true,
      failMessage: msg.slice(0, 240),
    };
  }
}
