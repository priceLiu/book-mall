import type { SimpleFusionPreviewSlot } from "@/lib/simple-fusion-preview-slots";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import type { EcomMediaRenderProfileInput } from "@/lib/ecom-storyboard-api";

export type ComposeWorkbenchClip = {
  id: string;
  videoUrl: string;
  label?: string;
  posterUrl?: string;
  durationSec?: number;
  sourceStartSec?: number;
  sourceEndSec?: number;
  subtitle?: string;
  audioUrl?: string;
  lookId?: string;
  source: "look" | "import";
};

export const COMPOSE_MIN_CLIP_SEC = 0.25;

export function composeClipSourceStart(clip: ComposeWorkbenchClip): number {
  return clip.sourceStartSec ?? 0;
}

export function composeClipSourceEnd(
  clip: ComposeWorkbenchClip,
  fullSourceSec: number,
): number {
  return clip.sourceEndSec ?? fullSourceSec;
}

export function composeClipSpanSec(
  clip: ComposeWorkbenchClip,
  fullSourceSec: number,
): number {
  const start = composeClipSourceStart(clip);
  const end = composeClipSourceEnd(clip, fullSourceSec);
  return Math.max(COMPOSE_MIN_CLIP_SEC, end - start);
}

export type ComposeWorkbenchState = {
  orderedClipIds: string[];
  clips: ComposeWorkbenchClip[];
  profile?: EcomMediaRenderProfileInput;
};

export function buildDefaultComposeFromSlots(
  slots: SimpleFusionPreviewSlot[],
): ComposeWorkbenchState {
  const clips: ComposeWorkbenchClip[] = [];
  for (const slot of slots) {
    const url = slot.clipVideoUrl?.trim();
    if (!url) continue;
    if (slot.status === "failed" || slot.status === "fusion_failed") continue;
    clips.push({
      id: `look-${slot.key}`,
      videoUrl: url,
      label: slot.caption,
      posterUrl: slot.fusedImageUrl?.trim(),
      lookId: slot.key,
      source: "look",
    });
  }
  return { orderedClipIds: clips.map((c) => c.id), clips };
}

function clipById(state: ComposeWorkbenchState): Map<string, ComposeWorkbenchClip> {
  return new Map(state.clips.map((c) => [c.id, c]));
}

export function resolveComposeWorkbenchFromProject(
  project: SimpleFusionProject,
  slots: SimpleFusionPreviewSlot[],
): ComposeWorkbenchState {
  const defaults = buildDefaultComposeFromSlots(slots);
  const raw = project.meta?.composeWorkbench as ComposeWorkbenchState | undefined;
  if (!raw?.orderedClipIds?.length || !raw.clips?.length) {
    return defaults;
  }

  const map = new Map(raw.clips.map((c) => [c.id, c]));
  const freshByLook = new Map(
    defaults.clips.filter((c) => c.lookId).map((c) => [c.lookId!, c]),
  );

  const orderedClipIds: string[] = [];
  const clips: ComposeWorkbenchClip[] = [];

  for (const id of raw.orderedClipIds) {
    const existing = map.get(id);
    if (!existing?.videoUrl?.trim()) continue;
    if (existing.lookId) {
      const fresh = freshByLook.get(existing.lookId);
      if (fresh) {
        clips.push({
          ...existing,
          videoUrl: fresh.videoUrl,
          posterUrl: fresh.posterUrl ?? existing.posterUrl,
          label: fresh.label ?? existing.label,
        });
        orderedClipIds.push(id);
        continue;
      }
    }
    clips.push(existing);
    orderedClipIds.push(id);
  }

  for (const d of defaults.clips) {
    if (d.lookId && !clips.some((c) => c.lookId === d.lookId)) {
      clips.push(d);
      orderedClipIds.push(d.id);
    }
  }

  return { orderedClipIds, clips, profile: raw.profile };
}

export function orderedComposeClips(state: ComposeWorkbenchState): ComposeWorkbenchClip[] {
  const map = clipById(state);
  return state.orderedClipIds
    .map((id) => map.get(id))
    .filter((c): c is ComposeWorkbenchClip => Boolean(c?.videoUrl?.trim()));
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

export function removeComposeClip(state: ComposeWorkbenchState, clipId: string): ComposeWorkbenchState {
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

/** 剪映式：在源片时刻切开，成片顺序变为两段（非破坏性入出点） */
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

function adjacentSourceBoundary(
  leftEnd: number,
  rightStart: number,
): boolean {
  return Math.abs(leftEnd - rightStart) < 0.08;
}

/** 同源相邻段 ripple：改当前段入出点时同步贴邻段的边界（剪映式缩短中间段时后段左移） */
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

export const DEFAULT_COMPOSE_PROFILE: EcomMediaRenderProfileInput = {
  transition: { type: "xfade", durationSec: 0.6 },
  video: { scaleMode: "fit1080p" },
  subtitle: { mode: "script", burnIn: false },
  audio: {
    mixTts: true,
    bgmVolume: 0.35,
    dialogueVolume: 0.95,
    bgmFitTimeline: true,
  },
};
