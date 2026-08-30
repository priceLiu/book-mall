/**
 * 从历史 Gateway ASR 日志推断 audioDurationSec（AR-104 回填）。
 */
import {
  parseAsrSentencesFromTranscriptionJson,
  type DashscopeAsrSentence,
} from "@/lib/gateway/dashscope-client";
import { resolveBillableAudioSecondsFromLog } from "@/lib/gateway/log-billing-metrics";

export function audioDurationSecFromSentences(sentences: DashscopeAsrSentence[]): number {
  if (sentences.length === 0) return 1;
  const maxMs = Math.max(...sentences.map((s) => s.endMs));
  return Math.max(1, Math.ceil(maxMs / 1000));
}

function resultRecord(resultSummary: unknown): Record<string, unknown> | null {
  if (!resultSummary || typeof resultSummary !== "object" || Array.isArray(resultSummary)) {
    return null;
  }
  return resultSummary as Record<string, unknown>;
}

function isAsrModel(model: string | null | undefined, canonical?: string | null): boolean {
  const m = (model ?? "").toLowerCase();
  const c = (canonical ?? "").toLowerCase();
  return m.includes("asr") || m.includes("qwen3-asr") || c.includes("asr");
}

function segmentsFromResultSummary(result: Record<string, unknown>): DashscopeAsrSentence[] {
  const segments = result.segments;
  if (!Array.isArray(segments)) return [];
  const out: DashscopeAsrSentence[] = [];
  for (const s of segments) {
    if (!s || typeof s !== "object") continue;
    const row = s as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    const beginMs =
      typeof row.startMs === "number"
        ? row.startMs
        : typeof row.beginMs === "number"
          ? row.beginMs
          : Number(row.begin_time);
    const endMs =
      typeof row.endMs === "number"
        ? row.endMs
        : typeof row.endMs === "number"
          ? row.endMs
          : Number(row.end_time);
    if (!Number.isFinite(beginMs) || !Number.isFinite(endMs)) continue;
    out.push({ beginMs, endMs, text });
  }
  return out;
}

function parseEmbeddedTranscripts(raw: unknown): DashscopeAsrSentence[] {
  if (!raw || typeof raw !== "object") return [];
  const root = raw as Record<string, unknown>;
  const output = root.output;
  if (output && typeof output === "object") {
    const fromOutput = parseAsrSentencesFromTranscriptionJson(output);
    if (fromOutput.length > 0) return fromOutput;
  }
  return parseAsrSentencesFromTranscriptionJson(raw);
}

/** 从单条日志推断音频秒数；无法推断时返回 null。 */
export function inferAsrAudioDurationSecFromLog(log: {
  model?: string | null;
  canonicalModelKey?: string | null;
  inputSummary?: unknown;
  resultSummary?: unknown;
}): number | null {
  if (!isAsrModel(log.model, log.canonicalModelKey)) return null;

  const existing = resolveBillableAudioSecondsFromLog(log, log.resultSummary);
  if (existing != null && existing > 0) return existing;

  const result = resultRecord(log.resultSummary);
  if (!result) return null;

  const fromSegments = audioDurationSecFromSentences(segmentsFromResultSummary(result));
  if (fromSegments > 1 || (result.segmentCount != null && Number(result.segmentCount) > 0)) {
    if (fromSegments > 0) return fromSegments;
  }

  const fromEmbedded = audioDurationSecFromSentences(parseEmbeddedTranscripts(log.resultSummary));
  if (fromEmbedded > 0) return fromEmbedded;

  if (result.noSpeech === true) return 1;

  return null;
}

/** 合并 audioDurationSec 到 resultSummary（保留其它字段）。 */
export function mergeAsrAudioDurationIntoResultSummary(
  resultSummary: unknown,
  audioDurationSec: number,
): Record<string, unknown> {
  const base =
    resultSummary && typeof resultSummary === "object" && !Array.isArray(resultSummary)
      ? { ...(resultSummary as Record<string, unknown>) }
      : {};
  const sec = Math.max(1, Math.round(audioDurationSec));
  return { ...base, audioDurationSec: sec, sourceAudioDurationSec: sec };
}
