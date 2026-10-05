import { randomUUID } from "crypto";

import {
  composeWorkbenchProfileToRenderProfile,
  emptyPlatformComposeWorkbenchState,
  parsePlatformComposeWorkbenchFromMeta,
  platformWorkbenchToMediaTimeline,
  type PlatformComposeWorkbenchClip,
  type PlatformComposeWorkbenchState,
} from "@/lib/media/platform-compose-workbench";

import { resolveSimpleFusionBgmUrl } from "./render";
import type { SimpleFusionLook, SimpleFusionProjectDto, SimpleFusionSettings } from "./types";

export type SimpleFusionComposeWorkbenchClip = Omit<
  PlatformComposeWorkbenchClip,
  "source"
> & {
  source: "look" | "import";
};

export type SimpleFusionComposeWorkbenchState = Omit<
  PlatformComposeWorkbenchState,
  "clips"
> & {
  clips: SimpleFusionComposeWorkbenchClip[];
};

export function emptyComposeWorkbenchState(): SimpleFusionComposeWorkbenchState {
  return emptyPlatformComposeWorkbenchState() as SimpleFusionComposeWorkbenchState;
}

function clipMap(state: SimpleFusionComposeWorkbenchState): Map<string, SimpleFusionComposeWorkbenchClip> {
  return new Map(state.clips.map((c) => [c.id, c]));
}

/** 从 looks 生成默认片段（成功片段） */
export function buildDefaultComposeClipsFromLooks(
  looks: SimpleFusionLook[],
  labels: Map<string, string>,
): SimpleFusionComposeWorkbenchState {
  const clips: SimpleFusionComposeWorkbenchClip[] = [];
  for (const look of looks) {
    const url = look.clipVideoUrl?.trim();
    if (!url || look.status === "failed" || look.status === "fusion_failed") continue;
    clips.push({
      id: `look-${look.lookId}`,
      videoUrl: url,
      label: labels.get(look.lookId) ?? labels.get(look.garmentId) ?? "片段",
      posterUrl: look.fusedImageUrl?.trim(),
      lookId: look.lookId,
      source: "look",
      subtitle: look.voiceover?.trim() || undefined,
      audioUrl: look.ttsUrl?.trim() || undefined,
    });
  }
  return {
    orderedClipIds: clips.map((c) => c.id),
    clips,
  };
}

export function parseComposeWorkbenchFromMeta(raw: unknown): SimpleFusionComposeWorkbenchState | null {
  const parsed = parsePlatformComposeWorkbenchFromMeta(raw);
  if (!parsed) return null;
  return {
    orderedClipIds: parsed.orderedClipIds,
    clips: parsed.clips.map((c) => ({
      ...c,
      source: c.source === "import" ? "import" : "look",
    })),
    profile: parsed.profile,
  };
}

/** 合并 persisted workbench 与最新 look 片段 URL */
export function resolveComposeWorkbenchState(
  project: SimpleFusionProjectDto,
  lookLabels: Map<string, string>,
): SimpleFusionComposeWorkbenchState {
  const looks = project.meta?.looks ?? [];
  const fromMeta = parseComposeWorkbenchFromMeta(project.meta?.composeWorkbench);
  const defaults = buildDefaultComposeClipsFromLooks(looks, lookLabels);

  if (!fromMeta || fromMeta.orderedClipIds.length === 0) {
    return defaults.clips.length ? defaults : emptyComposeWorkbenchState();
  }

  const byId = clipMap(fromMeta);
  const lookByLookId = new Map(
    defaults.clips.filter((c) => c.lookId).map((c) => [c.lookId!, c]),
  );

  const orderedClipIds: string[] = [];
  const clips: SimpleFusionComposeWorkbenchClip[] = [];

  for (const id of fromMeta.orderedClipIds) {
    const existing = byId.get(id);
    if (!existing) continue;
    if (existing.lookId) {
      const fresh = lookByLookId.get(existing.lookId);
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
    }
    if (existing.videoUrl?.trim()) {
      clips.push(existing);
      orderedClipIds.push(id);
    }
  }

  for (const d of defaults.clips) {
    if (!d.lookId) continue;
    const already = clips.some((c) => c.lookId === d.lookId);
    if (!already) {
      clips.push(d);
      orderedClipIds.push(d.id);
    }
  }

  return {
    orderedClipIds,
    clips,
    profile: fromMeta.profile,
  };
}

export function workbenchToMediaTimeline(state: SimpleFusionComposeWorkbenchState) {
  return platformWorkbenchToMediaTimeline(state);
}

export function resolveComposeRenderProfile(
  settings: SimpleFusionSettings,
  workbench?: SimpleFusionComposeWorkbenchState | null,
) {
  return composeWorkbenchProfileToRenderProfile(workbench?.profile, {
    fallbackBgmPresetId: settings.bgmPresetId,
    resolveBgmPresetUrl: resolveSimpleFusionBgmUrl,
  });
}

export function newImportComposeClip(args: {
  videoUrl: string;
  label?: string;
  durationSec?: number;
}): SimpleFusionComposeWorkbenchClip {
  return {
    id: `import-${randomUUID()}`,
    videoUrl: args.videoUrl.trim(),
    label: args.label?.trim() || "导入片段",
    durationSec: args.durationSec,
    source: "import",
  };
}
