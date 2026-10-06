import type { ComposeWorkbenchClip, ComposeWorkbenchState } from "./types";

export type { ComposeWorkbenchClip, ComposeWorkbenchState };

export const COMPOSE_MIN_CLIP_SEC = 0.25;
/** 配音解码前占位宽度（避免 0.25s 细线；解码后会被真实时长替换） */
export const COMPOSE_AUDIO_PENDING_SPAN_SEC = 3;

export function composeClipSourceStart(clip: ComposeWorkbenchClip): number {
  return clip.sourceStartSec ?? 0;
}

export function composeClipSourceEnd(
  clip: ComposeWorkbenchClip,
  fullSourceSec: number,
): number {
  return clip.sourceEndSec ?? fullSourceSec;
}

/** 预览 / 播放 · 源内有效出点（与时间线 span 对齐，避免播进未入 timeline 的尾部） */
export function composeClipEffectiveSourceEnd(
  clip: ComposeWorkbenchClip,
  programSpanSec: number,
  fullSourceSec: number,
): number {
  const start = composeClipSourceStart(clip);
  const nominalEnd = composeClipSourceEnd(clip, fullSourceSec);
  const spanEnd = start + Math.max(COMPOSE_MIN_CLIP_SEC, programSpanSec);
  return Math.min(nominalEnd, spanEnd);
}

export function composeClipSpanSec(
  clip: ComposeWorkbenchClip,
  fullSourceSec: number,
): number {
  const start = composeClipSourceStart(clip);
  const end = composeClipSourceEnd(clip, fullSourceSec);
  return Math.max(COMPOSE_MIN_CLIP_SEC, end - start);
}

function clipById(state: ComposeWorkbenchState): Map<string, ComposeWorkbenchClip> {
  return new Map(state.clips.map((c) => [c.id, c]));
}

export function orderedComposeClips(state: ComposeWorkbenchState): ComposeWorkbenchClip[] {
  const map = clipById(state);
  return state.orderedClipIds
    .map((id) => map.get(id))
    .filter((c): c is ComposeWorkbenchClip => Boolean(c?.videoUrl?.trim()));
}

export function orderedComposeAudioClips(
  state: ComposeWorkbenchState,
): ComposeWorkbenchClip[] {
  const ids = state.orderedAudioClipIds ?? [];
  const map = new Map((state.audioClips ?? []).map((c) => [c.id, c]));
  return ids
    .map((id) => map.get(id))
    .filter((c): c is ComposeWorkbenchClip => Boolean(c?.audioUrl?.trim()));
}

export function moveComposeAudioClip(
  state: ComposeWorkbenchState,
  fromIndex: number,
  toIndex: number,
): ComposeWorkbenchState {
  const ids = [...(state.orderedAudioClipIds ?? [])];
  if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) {
    return state;
  }
  const [item] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, item!);
  return { ...state, orderedAudioClipIds: ids };
}

export function updateComposeAudioClip(
  state: ComposeWorkbenchState,
  clipId: string,
  patch: Partial<ComposeWorkbenchClip>,
): ComposeWorkbenchState {
  return {
    ...state,
    audioClips: (state.audioClips ?? []).map((c) =>
      c.id === clipId ? { ...c, ...patch } : c,
    ),
  };
}

export function toggleComposeClipSourceAudioMuted(
  state: ComposeWorkbenchState,
  clipId: string,
): ComposeWorkbenchState {
  const clip = state.clips.find((c) => c.id === clipId);
  if (!clip) return state;
  return updateComposeClip(state, clipId, {
    sourceAudioMuted: !(clip.sourceAudioMuted ?? false),
  });
}

export function toggleComposeAudioClipPlaybackMuted(
  state: ComposeWorkbenchState,
  clipId: string,
): ComposeWorkbenchState {
  const clip = (state.audioClips ?? []).find((c) => c.id === clipId);
  if (!clip) return state;
  return updateComposeAudioClip(state, clipId, {
    audioPlaybackMuted: !(clip.audioPlaybackMuted ?? false),
  });
}

export function composeProgramDurationSec(
  clips: ComposeWorkbenchClip[],
  hints?: ComposeDurationHints,
): number {
  return (
    buildProgramSegmentsForClips(clips, hints).reduce((s, x) => s + x.span, 0) ||
    1
  );
}

export function resolveComposeClipAtProgramSec(
  clips: ComposeWorkbenchClip[],
  programSec: number,
  hints?: ComposeDurationHints,
): {
  clip: ComposeWorkbenchClip;
  programStart: number;
  span: number;
  localInClip: number;
  sourceSec: number;
} | null {
  const segments = buildProgramSegmentsForClips(clips, hints);
  if (segments.length === 0) return null;
  const total = segments.reduce((s, x) => s + x.span, 0);
  const clamped = Math.max(0, Math.min(programSec, total));
  let acc = 0;
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]!;
    const isLast = i === segments.length - 1;
    // 段尾（clamped === acc + span）归入下一段，避免卡在上一段末帧
    if (clamped < acc + seg.span || isLast) {
      const localInClip = Math.max(0, Math.min(clamped - acc, seg.span));
      const srcStart = composeClipSourceStart(seg.clip);
      return {
        clip: seg.clip,
        programStart: seg.programStart,
        span: seg.span,
        localInClip,
        sourceSec: srcStart + localInClip,
      };
    }
    acc += seg.span;
  }
  return null;
}

export type ComposeDurationHints = {
  audioDurationByUrl?: Record<string, number>;
  videoDurationByUrl?: Record<string, number>;
};

function defaultDisplaySpanSec(clip: ComposeWorkbenchClip): number {
  if (clip.durationSec != null && clip.durationSec > 0) return clip.durationSec;
  if (clip.sourceEndSec != null) {
    return Math.max(
      COMPOSE_MIN_CLIP_SEC,
      clip.sourceEndSec - (clip.sourceStartSec ?? 0),
    );
  }
  return 5;
}

/** 时间线 / 预览 · 片段在 program 上的时长（优先真实媒体时长） */
export function composeClipDisplaySpanSec(
  clip: ComposeWorkbenchClip,
  hints?: ComposeDurationHints,
): number {
  const start = composeClipSourceStart(clip);
  if (clip.sourceEndSec != null && clip.sourceEndSec > start) {
    return Math.max(COMPOSE_MIN_CLIP_SEC, clip.sourceEndSec - start);
  }
  if (clip.durationSec != null && clip.durationSec > 0) {
    return Math.max(COMPOSE_MIN_CLIP_SEC, clip.durationSec);
  }
  const videoUrl = clip.videoUrl?.trim();
  const audioUrl = clip.audioUrl?.trim();
  if (!videoUrl && audioUrl) {
    const full = hints?.audioDurationByUrl?.[audioUrl];
    if (full != null && full > 0) {
      return Math.max(COMPOSE_MIN_CLIP_SEC, full - start);
    }
    return COMPOSE_AUDIO_PENDING_SPAN_SEC;
  }
  if (videoUrl) {
    const full = hints?.videoDurationByUrl?.[videoUrl];
    if (full != null && full > 0) {
      const end = clip.sourceEndSec ?? full;
      return Math.max(COMPOSE_MIN_CLIP_SEC, end - start);
    }
  }
  return defaultDisplaySpanSec(clip);
}

function buildProgramSegmentsForClips(
  clips: ComposeWorkbenchClip[],
  hints?: ComposeDurationHints,
) {
  let t = 0;
  return clips.map((clip) => {
    const span = composeClipDisplaySpanSec(clip, hints);
    const seg = { clip, programStart: t, span };
    t += span;
    return seg;
  });
}

export type VideoProgramSegment = {
  clip: ComposeWorkbenchClip;
  programStart: number;
  span: number;
};

export function buildVideoProgramSegments(
  state: ComposeWorkbenchState,
  hints?: ComposeDurationHints,
): VideoProgramSegment[] {
  return buildProgramSegmentsForClips(orderedComposeClips(state), hints);
}

export function videoProgramStartForClipId(
  state: ComposeWorkbenchState,
  videoClipId: string,
  hints?: ComposeDurationHints,
): number | null {
  for (const seg of buildVideoProgramSegments(state, hints)) {
    if (seg.clip.id === videoClipId) return seg.programStart;
  }
  return null;
}

/** 配音段默认起始 = 第 N 段视频左缘（N 为 orderedAudio 索引） */
export function resolveAudioClipProgramStartSec(
  state: ComposeWorkbenchState,
  audioClip: ComposeWorkbenchClip,
  audioIndex: number,
  hints?: ComposeDurationHints,
): number {
  if (
    audioClip.programStartSec != null &&
    Number.isFinite(audioClip.programStartSec)
  ) {
    return Math.max(0, audioClip.programStartSec);
  }
  const paired = audioClip.pairedTimelineClipId?.trim();
  if (paired) {
    const at = videoProgramStartForClipId(state, paired, hints);
    if (at != null) return at;
  }
  const videoSegs = buildVideoProgramSegments(state, hints);
  if (videoSegs[audioIndex]) return videoSegs[audioIndex]!.programStart;
  let t = 0;
  for (const seg of videoSegs) t += seg.span;
  return t;
}

export type AudioTimelinePlacement = {
  clip: ComposeWorkbenchClip;
  index: number;
  programStart: number;
  span: number;
};

export function buildAudioTimelinePlacements(
  state: ComposeWorkbenchState,
  hints?: ComposeDurationHints,
): AudioTimelinePlacement[] {
  const audios = orderedComposeAudioClips(state);
  return audios.map((clip, index) => ({
    clip,
    index,
    programStart: resolveAudioClipProgramStartSec(state, clip, index, hints),
    span: composeClipDisplaySpanSec(clip, hints),
  }));
}

export function resolveProgramAudioAtSec(
  state: ComposeWorkbenchState,
  programSec: number,
  hints?: ComposeDurationHints,
): {
  clip: ComposeWorkbenchClip;
  programStart: number;
  span: number;
  localInClip: number;
  sourceSec: number;
} | null {
  const placements = buildAudioTimelinePlacements(state, hints);
  if (placements.length === 0) return null;
  const clamped = Math.max(0, programSec);
  for (const p of placements) {
    const end = p.programStart + p.span;
    if (clamped >= p.programStart && clamped < end - 0.0005) {
      const localInClip = clamped - p.programStart;
      return {
        clip: p.clip,
        programStart: p.programStart,
        span: p.span,
        localInClip,
        sourceSec: composeClipSourceStart(p.clip) + localInClip,
      };
    }
  }
  return null;
}

const AUDIO_SNAP_FINE_SEC = 0.02;

/** 吸附视频段起/止点；否则 20ms 精度 */
export function snapAudioProgramStartSec(
  startSec: number,
  videoSegments: VideoProgramSegment[],
  opts?: { pxPerSec?: number; snapPx?: number },
): number {
  const pxPerSec = opts?.pxPerSec ?? 40;
  const snapThresholdSec = (opts?.snapPx ?? 12) / pxPerSec;
  let best = Math.max(0, startSec);
  let bestDist = snapThresholdSec + 1;
  const candidates: number[] = [];
  for (const v of videoSegments) {
    candidates.push(v.programStart, v.programStart + v.span);
  }
  for (const c of candidates) {
    const d = Math.abs(startSec - c);
    if (d <= snapThresholdSec && d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  if (bestDist <= snapThresholdSec) return Math.max(0, best);
  return Math.max(0, Math.round(startSec / AUDIO_SNAP_FINE_SEC) * AUDIO_SNAP_FINE_SEC);
}

export function setComposeAudioProgramStart(
  state: ComposeWorkbenchState,
  audioClipId: string,
  programStartSec: number,
): ComposeWorkbenchState {
  return updateComposeAudioClip(state, audioClipId, {
    programStartSec: Math.max(0, programStartSec),
  });
}

/** 双轨 · 节目总时长 = max(视频总长, 配音块最晚结束) */
export function composeDualTrackProgramDurationSec(
  state: ComposeWorkbenchState,
  hints?: ComposeDurationHints,
): number {
  const v = composeProgramDurationSec(orderedComposeClips(state), hints);
  const audioEnd = buildAudioTimelinePlacements(state, hints).reduce(
    (m, p) => Math.max(m, p.programStart + p.span),
    0,
  );
  return Math.max(v, audioEnd, 1);
}

export function moveComposeClip(
  state: ComposeWorkbenchState,
  fromIndex: number,
  toIndex: number,
): ComposeWorkbenchState {
  const ids = [...state.orderedClipIds];
  if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) {
    return state;
  }
  const [item] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, item!);
  return { ...state, orderedClipIds: ids };
}

export function appendImportedComposeClip(
  state: ComposeWorkbenchState,
  clip: { videoUrl: string; posterUrl?: string; label?: string },
): ComposeWorkbenchState {
  const videoUrl = clip.videoUrl.trim();
  if (!videoUrl) return state;
  const id = `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const next: ComposeWorkbenchClip = {
    id,
    videoUrl,
    posterUrl: clip.posterUrl?.trim(),
    label: clip.label?.trim() || "导入片段",
    source: "import",
  };
  return {
    ...state,
    orderedClipIds: [...state.orderedClipIds, id],
    clips: [...state.clips, next],
  };
}

export function removeComposeClip(
  state: ComposeWorkbenchState,
  clipId: string,
): ComposeWorkbenchState {
  return {
    ...state,
    orderedClipIds: state.orderedClipIds.filter((id) => id !== clipId),
    clips: state.clips.filter((c) => c.id !== clipId),
  };
}

export function updateComposeClip(
  state: ComposeWorkbenchState,
  clipId: string,
  patch: Partial<ComposeWorkbenchClip>,
): ComposeWorkbenchState {
  return {
    ...state,
    clips: state.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
  };
}

export function splitComposeClipAtSourceSec(
  state: ComposeWorkbenchState,
  clipId: string,
  atSec: number,
  fullSourceSec: number,
): ComposeWorkbenchState {
  const clip = state.clips.find((c) => c.id === clipId);
  if (!clip) return state;
  const start = composeClipSourceStart(clip);
  const end = composeClipSourceEnd(clip, fullSourceSec);
  if (atSec <= start + COMPOSE_MIN_CLIP_SEC || atSec >= end - COMPOSE_MIN_CLIP_SEC) {
    return state;
  }
  const orderIdx = state.orderedClipIds.indexOf(clipId);
  if (orderIdx < 0) return state;
  const stamp = Date.now();
  const baseLabel = clip.label?.trim() || "片段";
  const clipA: ComposeWorkbenchClip = {
    ...clip,
    id: `${clipId}-split-${stamp}-a`,
    lookId: undefined,
    source: clip.source === "import" ? "import" : "import",
    label: `${baseLabel}·前`,
    sourceStartSec: start,
    sourceEndSec: atSec,
    durationSec: atSec - start,
  };
  const clipB: ComposeWorkbenchClip = {
    ...clip,
    id: `${clipId}-split-${stamp}-b`,
    lookId: undefined,
    source: clip.source === "import" ? "import" : "import",
    label: `${baseLabel}·后`,
    sourceStartSec: atSec,
    sourceEndSec: end,
    durationSec: end - atSec,
  };
  const orderedClipIds = [...state.orderedClipIds];
  orderedClipIds.splice(orderIdx, 1, clipA.id, clipB.id);
  const clips = state.clips.filter((c) => c.id !== clipId).concat([clipA, clipB]);
  return { ...state, orderedClipIds, clips };
}

export function setComposeClipSourceRange(
  state: ComposeWorkbenchState,
  clipId: string,
  startSec: number,
  endSec: number,
  fullSourceSec: number,
): ComposeWorkbenchState {
  const start = Math.max(0, Math.min(startSec, fullSourceSec - COMPOSE_MIN_CLIP_SEC));
  const end = Math.max(
    start + COMPOSE_MIN_CLIP_SEC,
    Math.min(endSec, fullSourceSec),
  );
  return updateComposeClip(state, clipId, {
    sourceStartSec: start > 0.02 ? start : undefined,
    sourceEndSec: end < fullSourceSec - 0.02 ? end : undefined,
    durationSec: end - start,
  });
}

function sameVideoUrl(a: string, b: string): boolean {
  return a.trim() === b.trim();
}

function adjacentSourceBoundary(leftEnd: number, rightStart: number): boolean {
  return Math.abs(leftEnd - rightStart) < 0.08;
}

export function setComposeClipSourceRangeWithRipple(
  state: ComposeWorkbenchState,
  clipId: string,
  startSec: number,
  endSec: number,
  fullSourceSec: number,
): ComposeWorkbenchState {
  const idx = state.orderedClipIds.indexOf(clipId);
  const clip = state.clips.find((c) => c.id === clipId);
  if (!clip || idx < 0) return state;

  const oldStart = composeClipSourceStart(clip);
  const oldEnd = composeClipSourceEnd(clip, fullSourceSec);

  let next = setComposeClipSourceRange(state, clipId, startSec, endSec, fullSourceSec);
  const updated = next.clips.find((c) => c.id === clipId);
  if (!updated) return next;

  const newStart = composeClipSourceStart(updated);
  const newEnd = composeClipSourceEnd(updated, fullSourceSec);

  if (idx > 0 && Math.abs(newStart - oldStart) > 0.001) {
    const prevId = next.orderedClipIds[idx - 1]!;
    const prev = next.clips.find((c) => c.id === prevId);
    if (
      prev &&
      sameVideoUrl(prev.videoUrl, clip.videoUrl) &&
      adjacentSourceBoundary(composeClipSourceEnd(prev, fullSourceSec), oldStart)
    ) {
      next = setComposeClipSourceRange(
        next,
        prevId,
        composeClipSourceStart(prev),
        newStart,
        fullSourceSec,
      );
    }
  }

  if (idx < next.orderedClipIds.length - 1 && Math.abs(newEnd - oldEnd) > 0.001) {
    const nextId = next.orderedClipIds[idx + 1]!;
    const succ = next.clips.find((c) => c.id === nextId);
    if (
      succ &&
      sameVideoUrl(succ.videoUrl, clip.videoUrl) &&
      adjacentSourceBoundary(oldEnd, composeClipSourceStart(succ))
    ) {
      next = setComposeClipSourceRange(
        next,
        nextId,
        newEnd,
        composeClipSourceEnd(succ, fullSourceSec),
        fullSourceSec,
      );
    }
  }

  return next;
}
