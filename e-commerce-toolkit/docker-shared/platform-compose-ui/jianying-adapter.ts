import {
  composeClipSourceEnd,
  composeClipSourceStart,
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
};

export function jianyingSnapshotToWorkbench(
  snapshotClips: JianyingSnapshotClip[],
  persisted?: ComposeWorkbenchState | null,
): ComposeWorkbenchState {
  const defaults: ComposeWorkbenchState = {
    orderedClipIds: snapshotClips.map((c) => c.sourceNodeId),
    clips: snapshotClips
      .filter((c) => c.videoUrl.trim())
      .map((c) => ({
        id: c.sourceNodeId,
        videoUrl: c.videoUrl.trim(),
        posterUrl: c.posterUrl?.trim(),
        label: c.label?.trim(),
        subtitle: c.dialogue?.trim(),
        audioUrl: c.audioUrl?.trim(),
        source: "external" as const,
      })),
  };

  if (!persisted?.orderedClipIds?.length || !persisted.clips?.length) {
    return defaults;
  }

  const byId = new Map(persisted.clips.map((c) => [c.id, c]));
  const freshById = new Map(defaults.clips.map((c) => [c.id, c]));

  const orderedClipIds: string[] = [];
  const clips: ComposeWorkbenchClip[] = [];

  for (const id of persisted.orderedClipIds) {
    const existing = byId.get(id);
    const fresh = freshById.get(id);
    if (!existing) continue;
    if (fresh) {
      clips.push({
        ...existing,
        videoUrl: fresh.videoUrl,
        posterUrl: fresh.posterUrl ?? existing.posterUrl,
        label: fresh.label ?? existing.label,
        subtitle: existing.subtitle?.trim()
          ? existing.subtitle
          : fresh.subtitle ?? existing.subtitle,
        audioUrl: existing.audioUrl?.trim()
          ? existing.audioUrl
          : fresh.audioUrl ?? existing.audioUrl,
      });
      orderedClipIds.push(id);
      continue;
    }
    if (existing.videoUrl?.trim()) {
      clips.push(existing);
      orderedClipIds.push(id);
    }
  }

  for (const d of defaults.clips) {
    if (!orderedClipIds.includes(d.id)) {
      clips.push(d);
      orderedClipIds.push(d.id);
    }
  }

  return {
    orderedClipIds,
    clips,
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

export function workbenchToJianyingExportFrames(
  workbench: ComposeWorkbenchState,
  fullDurationByUrl?: Record<string, number>,
): JianyingExportFrameFromWorkbench[] {
  const ordered = orderedComposeClips(workbench);
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
    return {
      frameIndex: i + 1,
      dialogue: clip.subtitle?.trim() ?? "",
      videoUrl: clip.videoUrl,
      audioUrl: clip.audioUrl ?? null,
      audioSourceNodeId: clip.audioUrl ? clip.id : null,
      durationSec: span,
      sourceStartSec: clip.sourceStartSec,
      sourceEndSec: clip.sourceEndSec,
    };
  });
}
