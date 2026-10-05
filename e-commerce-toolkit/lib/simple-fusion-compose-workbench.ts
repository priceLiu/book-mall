import type { SimpleFusionPreviewSlot } from "@/lib/simple-fusion-preview-slots";
import type { SimpleFusionProject } from "@/lib/ecom-simple-fusion-video-api";
import type { EcomMediaRenderProfileInput } from "@/lib/ecom-storyboard-api";
import { DEFAULT_COMPOSE_PROFILE as PLATFORM_DEFAULT_COMPOSE_PROFILE } from "@private/platform-compose-ui/default-compose-profile";
import {
  type ComposeWorkbenchClip as PlatformClip,
  type ComposeWorkbenchState as PlatformState,
  composeClipSourceEnd,
  composeClipSourceStart,
  composeClipSpanSec,
  moveComposeClip,
  orderedComposeClips,
  removeComposeClip,
  setComposeClipSourceRange,
  setComposeClipSourceRangeWithRipple,
  splitComposeClipAtSourceSec,
  updateComposeClip,
  COMPOSE_MIN_CLIP_SEC,
} from "@private/platform-compose-ui/editing";

export {
  COMPOSE_MIN_CLIP_SEC,
  composeClipSourceEnd,
  composeClipSourceStart,
  composeClipSpanSec,
  moveComposeClip,
  orderedComposeClips,
  removeComposeClip,
  setComposeClipSourceRange,
  setComposeClipSourceRangeWithRipple,
  splitComposeClipAtSourceSec,
  updateComposeClip,
};

export type ComposeWorkbenchClip = Omit<PlatformClip, "source"> & {
  source: "look" | "import";
};

export type ComposeWorkbenchState = Omit<PlatformState, "clips" | "profile"> & {
  clips: ComposeWorkbenchClip[];
  profile?: EcomMediaRenderProfileInput;
  orderedAudioClipIds?: PlatformState["orderedAudioClipIds"];
  audioClips?: PlatformState["audioClips"];
};

export const DEFAULT_COMPOSE_PROFILE: EcomMediaRenderProfileInput =
  PLATFORM_DEFAULT_COMPOSE_PROFILE;

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

  if (clips.length === 0) {
    return defaults;
  }

  return {
    orderedClipIds,
    clips,
    ...(raw.orderedAudioClipIds?.length
      ? { orderedAudioClipIds: raw.orderedAudioClipIds }
      : {}),
    ...(raw.audioClips?.length ? { audioClips: raw.audioClips } : {}),
    profile: raw.profile,
  };
}
