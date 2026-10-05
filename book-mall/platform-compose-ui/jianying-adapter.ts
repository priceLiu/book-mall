import { invalidateAudioAnalysisCache } from "./compose-audio-analysis-cache";
import {
  buildAudioTimelinePlacements,
  buildVideoProgramSegments,
  composeClipSourceEnd,
  composeClipSourceStart,
  type ComposeDurationHints,
  orderedComposeAudioClips,
  orderedComposeClips,
} from "./editing";
import type { ComposeWorkbenchClip, ComposeWorkbenchState } from "./types";

export type JianyingSnapshotClip = {
  sourceNodeId: string;
  videoUrl: string;
  posterUrl?: string;
  label?: string;
  dialogue?: string;
  audioUrl?: string;
  /** 与 audioUrl 一并变化 · 同 URL 覆盖时仍能刷新波形 */
  audioMediaKey?: string;
};

export type JianyingComposeSnapshotInput = {
  videoClips: JianyingSnapshotClip[];
  audioClips: JianyingSnapshotClip[];
};

function mapVideoSnapshotClip(c: JianyingSnapshotClip): ComposeWorkbenchClip {
  return {
    id: c.sourceNodeId,
    videoUrl: c.videoUrl.trim(),
    posterUrl: c.posterUrl?.trim(),
    label: c.label?.trim(),
    subtitle: c.dialogue?.trim(),
    source: "external" as const,
  };
}

function mapAudioSnapshotClip(c: JianyingSnapshotClip): ComposeWorkbenchClip {
  const audioUrl = c.audioUrl?.trim();
  return {
    id: c.sourceNodeId,
    videoUrl: "",
    label: c.label?.trim(),
    subtitle: c.dialogue?.trim(),
    audioUrl,
    audioMediaKey: c.audioMediaKey?.trim() || audioUrl,
    source: "external" as const,
  };
}

function mergeVideoTrack(
  fresh: ComposeWorkbenchClip[],
  persisted: ComposeWorkbenchState,
): { orderedClipIds: string[]; clips: ComposeWorkbenchClip[] } {
  const defaults = {
    orderedClipIds: fresh.map((c) => c.id),
    clips: fresh,
  };
  if (!persisted.orderedClipIds?.length || !persisted.clips?.length) {
    return defaults;
  }

  const byId = new Map(persisted.clips.map((c) => [c.id, c]));
  const freshById = new Map(fresh.map((c) => [c.id, c]));
  const orderedClipIds: string[] = [];
  const clips: ComposeWorkbenchClip[] = [];

  for (const id of persisted.orderedClipIds) {
    const existing = byId.get(id);
    const next = freshById.get(id);
    if (!existing) continue;
    if (next) {
      clips.push({
        ...existing,
        videoUrl: next.videoUrl,
        posterUrl: next.posterUrl ?? existing.posterUrl,
        label: next.label ?? existing.label,
        subtitle: existing.subtitle?.trim()
          ? existing.subtitle
          : next.subtitle ?? existing.subtitle,
        audioUrl: undefined,
      });
      orderedClipIds.push(id);
      continue;
    }
    if (existing.source === "import" && existing.videoUrl?.trim()) {
      clips.push({ ...existing, audioUrl: undefined });
      orderedClipIds.push(id);
    }
  }

  for (const d of fresh) {
    if (!orderedClipIds.includes(d.id)) {
      clips.push(d);
      orderedClipIds.push(d.id);
    }
  }

  return { orderedClipIds, clips };
}

function mergeAudioTrack(
  fresh: ComposeWorkbenchClip[],
  persisted: ComposeWorkbenchState,
): { orderedAudioClipIds: string[]; audioClips: ComposeWorkbenchClip[] } {
  const defaults = {
    orderedAudioClipIds: fresh.map((c) => c.id),
    audioClips: fresh,
  };
  const prevIds = persisted.orderedAudioClipIds ?? [];
  const prevClips = persisted.audioClips ?? [];
  if (!prevIds.length || !prevClips.length) {
    return defaults;
  }

  const byId = new Map(prevClips.map((c) => [c.id, c]));
  const freshById = new Map(fresh.map((c) => [c.id, c]));
  const orderedAudioClipIds: string[] = [];
  const audioClips: ComposeWorkbenchClip[] = [];

  for (const id of prevIds) {
    const existing = byId.get(id);
    const next = freshById.get(id);
    if (!existing) continue;
    if (next) {
      const freshUrl = next.audioUrl?.trim() ?? "";
      const prevUrl = existing.audioUrl?.trim() ?? "";
      const freshMediaKey = next.audioMediaKey?.trim() || freshUrl;
      const prevMediaKey =
        existing.audioMediaKey?.trim() || prevUrl;
      const mediaChanged =
        Boolean(freshMediaKey && freshMediaKey !== prevMediaKey);
      if (mediaChanged) {
        if (prevUrl) invalidateAudioAnalysisCache(prevUrl);
        if (freshUrl) invalidateAudioAnalysisCache(freshUrl);
      }
      audioClips.push({
        ...existing,
        audioUrl: freshUrl || existing.audioUrl,
        audioMediaKey: freshMediaKey || existing.audioMediaKey,
        label: next.label ?? existing.label,
        subtitle: existing.subtitle?.trim()
          ? existing.subtitle
          : next.subtitle ?? existing.subtitle,
        ...(mediaChanged ? { durationSec: undefined } : {}),
      });
      orderedAudioClipIds.push(id);
    }
  }

  for (const d of fresh) {
    if (!orderedAudioClipIds.includes(d.id)) {
      audioClips.push(d);
      orderedAudioClipIds.push(d.id);
    }
  }

  return { orderedAudioClipIds, audioClips };
}

export function jianyingSnapshotToWorkbench(
  input: JianyingComposeSnapshotInput | JianyingSnapshotClip[],
  persisted?: ComposeWorkbenchState | null,
): ComposeWorkbenchState {
  const normalized: JianyingComposeSnapshotInput = Array.isArray(input)
    ? { videoClips: input.filter((c) => c.videoUrl.trim()), audioClips: input.filter((c) => c.audioUrl?.trim() && !c.videoUrl.trim()) }
    : input;

  const freshVideo = normalized.videoClips
    .filter((c) => c.videoUrl.trim())
    .map(mapVideoSnapshotClip);
  const freshAudio = normalized.audioClips
    .filter((c) => c.audioUrl?.trim())
    .map(mapAudioSnapshotClip);

  if (!persisted?.orderedClipIds?.length) {
    return {
      orderedClipIds: freshVideo.map((c) => c.id),
      clips: freshVideo,
      orderedAudioClipIds: freshAudio.map((c) => c.id),
      audioClips: freshAudio,
      profile: persisted?.profile,
    };
  }

  const videoTrack = mergeVideoTrack(freshVideo, persisted);
  const audioTrack = mergeAudioTrack(freshAudio, persisted);

  return {
    ...videoTrack,
    ...audioTrack,
    profile: persisted.profile,
  };
}

export type JianyingExportFrameFromWorkbench = {
  frameIndex: number;
  dialogue: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  audioSourceNodeId?: string | null;
  durationSec?: number;
  sourceStartSec?: number;
  sourceEndSec?: number;
};

function pickAudioForVideoSegment(
  workbench: ComposeWorkbenchState,
  videoClipId: string,
  videoProgramStart: number,
  videoSpan: number,
  hints?: ComposeDurationHints,
) {
  const placements = buildAudioTimelinePlacements(workbench, hints);
  let best: (typeof placements)[number] | undefined;
  let bestScore = -1;
  for (const p of placements) {
    const end = p.programStart + p.span;
    const overlap =
      Math.min(videoProgramStart + videoSpan, end) -
      Math.max(videoProgramStart, p.programStart);
    if (overlap <= 0) continue;
    let score = overlap;
    if (p.clip.pairedTimelineClipId === videoClipId) score += 1000;
    if (Math.abs(p.programStart - videoProgramStart) < 0.05) score += 100;
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best?.clip;
}

export function workbenchToJianyingExportFrames(
  workbench: ComposeWorkbenchState,
  fullDurationByUrl?: Record<string, number>,
): JianyingExportFrameFromWorkbench[] {
  const ordered = orderedComposeClips(workbench);
  const hints: ComposeDurationHints = {
    videoDurationByUrl: fullDurationByUrl,
    audioDurationByUrl: Object.fromEntries(
      (workbench.audioClips ?? [])
        .map((c) => {
          const u = c.audioUrl?.trim();
          const d = c.durationSec;
          return u && d != null && d > 0 ? ([u, d] as const) : null;
        })
        .filter((x): x is [string, number] => Boolean(x)),
    ),
  };
  const videoSegs = buildVideoProgramSegments(workbench, hints);
  return ordered.map((clip, i) => {
    const full =
      fullDurationByUrl?.[clip.videoUrl.trim()] ??
      (clip.sourceEndSec != null
        ? composeClipSourceEnd(clip, clip.sourceEndSec + 1)
        : undefined);
    const span =
      full != null
        ? composeClipSourceEnd(clip, full) - composeClipSourceStart(clip)
        : clip.durationSec;
    const vSeg = videoSegs[i];
    const pairedAudio =
      vSeg != null
        ? pickAudioForVideoSegment(
            workbench,
            clip.id,
            vSeg.programStart,
            vSeg.span,
            hints,
          )
        : orderedComposeAudioClips(workbench)[i];
    return {
      frameIndex: i + 1,
      dialogue: clip.subtitle?.trim() ?? "",
      videoUrl: clip.videoUrl,
      audioUrl: pairedAudio?.audioUrl ?? null,
      audioSourceNodeId: pairedAudio?.id ?? null,
      durationSec: span,
      sourceStartSec: clip.sourceStartSec,
      sourceEndSec: clip.sourceEndSec,
    };
  });
}
