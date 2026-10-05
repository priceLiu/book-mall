import type {
  PlatformComposeWorkbenchClip,
  PlatformComposeWorkbenchState,
} from "@/lib/media/platform-compose-workbench";

export type { PlatformComposeWorkbenchClip, PlatformComposeWorkbenchState };

export const COMPOSE_MIN_CLIP_SEC = 0.25;

export function composeClipSourceStart(clip: PlatformComposeWorkbenchClip): number {
  return clip.sourceStartSec ?? 0;
}

export function composeClipSourceEnd(
  clip: PlatformComposeWorkbenchClip,
  fullSourceSec: number,
): number {
  return clip.sourceEndSec ?? fullSourceSec;
}

export function composeClipSpanSec(
  clip: PlatformComposeWorkbenchClip,
  fullSourceSec: number,
): number {
  const start = composeClipSourceStart(clip);
  const end = composeClipSourceEnd(clip, fullSourceSec);
  return Math.max(COMPOSE_MIN_CLIP_SEC, end - start);
}

function clipById(
  state: PlatformComposeWorkbenchState,
): Map<string, PlatformComposeWorkbenchClip> {
  return new Map(state.clips.map((c) => [c.id, c]));
}

export function orderedComposeClips(
  state: PlatformComposeWorkbenchState,
): PlatformComposeWorkbenchClip[] {
  const map = clipById(state);
  return state.orderedClipIds
    .map((id) => map.get(id))
    .filter((c): c is PlatformComposeWorkbenchClip => Boolean(c?.videoUrl?.trim()));
}

export function moveComposeClip(
  state: PlatformComposeWorkbenchState,
  fromIndex: number,
  toIndex: number,
): PlatformComposeWorkbenchState {
  const ids = [...state.orderedClipIds];
  if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) {
    return state;
  }
  const [item] = ids.splice(fromIndex, 1);
  ids.splice(toIndex, 0, item!);
  return { ...state, orderedClipIds: ids };
}

export function removeComposeClip(
  state: PlatformComposeWorkbenchState,
  clipId: string,
): PlatformComposeWorkbenchState {
  return {
    ...state,
    orderedClipIds: state.orderedClipIds.filter((id) => id !== clipId),
    clips: state.clips.filter((c) => c.id !== clipId),
  };
}

export function updateComposeClip(
  state: PlatformComposeWorkbenchState,
  clipId: string,
  patch: Partial<PlatformComposeWorkbenchClip>,
): PlatformComposeWorkbenchState {
  return {
    ...state,
    clips: state.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)),
  };
}

export function splitComposeClipAtSourceSec(
  state: PlatformComposeWorkbenchState,
  clipId: string,
  atSec: number,
  fullSourceSec: number,
): PlatformComposeWorkbenchState {
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
  const clipA: PlatformComposeWorkbenchClip = {
    ...clip,
    id: `${clipId}-split-${stamp}-a`,
    lookId: undefined,
    source: clip.source === "import" ? "import" : "import",
    label: `${baseLabel}·前`,
    sourceStartSec: start,
    sourceEndSec: atSec,
    durationSec: atSec - start,
  };
  const clipB: PlatformComposeWorkbenchClip = {
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
  state: PlatformComposeWorkbenchState,
  clipId: string,
  startSec: number,
  endSec: number,
  fullSourceSec: number,
): PlatformComposeWorkbenchState {
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
  state: PlatformComposeWorkbenchState,
  clipId: string,
  startSec: number,
  endSec: number,
  fullSourceSec: number,
): PlatformComposeWorkbenchState {
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
