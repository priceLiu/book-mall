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
  type DashscopeAsrSentence,
} from "@/lib/gateway/dashscope-client";
import { resolveGatewayAuthForBookUser } from "@/lib/gateway/book-gateway-link";
import { gatewayV1AsrTranscribe, gatewayV1ClientMeta } from "@/lib/gateway/gateway-v1-http-client";

export type AsrSegment = {
  startMs: number;
  endMs: number;
  text: string;
};

export type ClipAsrResult = {
  clipIndex: number;
  segments: AsrSegment[];
};

export async function transcribeClipViaGateway(args: {
  userId: string;
  fileUrl: string;
  modelKey?: string;
}): Promise<ClipAsrResult["segments"]> {
  const auth = await resolveGatewayAuthForBookUser(args.userId);
  if (!auth?.id) {
    throw new Error("未关联 Gateway API Key，无法使用语音识别烧字幕");
  }
  const { segments } = await gatewayV1AsrTranscribe({
    apiKeyId: auth.id,
    body: {
      fileUrl: args.fileUrl,
      modelKey: args.modelKey?.trim() || QWEN3_ASR_FLASH_FILETRANS_MODEL,
    },
    meta: gatewayV1ClientMeta("CANVAS", { bookUserId: args.userId }),
  });
  return segments;
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
