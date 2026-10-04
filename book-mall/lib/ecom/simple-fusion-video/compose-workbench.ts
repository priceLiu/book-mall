import { randomUUID } from "crypto";

import type { MediaTimelineV1, RenderProfile } from "@/lib/media/timeline-types";
import { parseRenderProfile } from "@/lib/media/timeline-types";

import { resolveSimpleFusionBgmUrl } from "./render";
import type { SimpleFusionLook, SimpleFusionProjectDto, SimpleFusionSettings } from "./types";

export type SimpleFusionComposeWorkbenchClip = {
  id: string;
  videoUrl: string;
  label?: string;
  posterUrl?: string;
  durationSec?: number;
  /** 源片入点（秒），默认 0 */
  sourceStartSec?: number;
  /** 源片出点（秒），默认全长 */
  sourceEndSec?: number;
  lookId?: string;
  source: "look" | "import";
};

export type SimpleFusionComposeWorkbenchState = {
  orderedClipIds: string[];
  clips: SimpleFusionComposeWorkbenchClip[];
  profile?: {
    transition?: RenderProfile["transition"];
    video?: RenderProfile["video"];
  };
};

export function emptyComposeWorkbenchState(): SimpleFusionComposeWorkbenchState {
  return { orderedClipIds: [], clips: [] };
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
    });
  }
  return {
    orderedClipIds: clips.map((c) => c.id),
    clips,
  };
}

export function parseComposeWorkbenchFromMeta(raw: unknown): SimpleFusionComposeWorkbenchState | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const clipsRaw = m.clips;
  const orderRaw = m.orderedClipIds;
  if (!Array.isArray(clipsRaw) || !Array.isArray(orderRaw)) return null;
  const clips: SimpleFusionComposeWorkbenchClip[] = [];
  for (const item of clipsRaw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const videoUrl = typeof c.videoUrl === "string" ? c.videoUrl.trim() : "";
    const id = typeof c.id === "string" ? c.id.trim() : "";
    if (!id || !videoUrl) continue;
    clips.push({
      id,
      videoUrl,
      label: typeof c.label === "string" ? c.label : undefined,
      posterUrl: typeof c.posterUrl === "string" ? c.posterUrl : undefined,
      durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
      sourceStartSec: typeof c.sourceStartSec === "number" ? c.sourceStartSec : undefined,
      sourceEndSec: typeof c.sourceEndSec === "number" ? c.sourceEndSec : undefined,
      lookId: typeof c.lookId === "string" ? c.lookId : undefined,
      source: c.source === "import" ? "import" : "look",
    });
  }
  const orderedClipIds = orderRaw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  const profile =
    m.profile && typeof m.profile === "object"
      ? (m.profile as SimpleFusionComposeWorkbenchState["profile"])
      : undefined;
  return { orderedClipIds, clips, profile };
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

export function workbenchToMediaTimeline(state: SimpleFusionComposeWorkbenchState): MediaTimelineV1 {
  const map = clipMap(state);
  const clips = state.orderedClipIds
    .map((id, order) => {
      const c = map.get(id);
      if (!c?.videoUrl?.trim()) return null;
      const start = c.sourceStartSec ?? 0;
      const end = c.sourceEndSec;
      const span =
        end != null && end > start
          ? end - start
          : c.durationSec != null && c.durationSec > 0
            ? c.durationSec
            : undefined;
      return {
        order,
        videoUrl: c.videoUrl.trim(),
        ...(start > 0 ? { sourceStartSec: start } : {}),
        ...(end != null && end > 0 ? { sourceEndSec: end } : {}),
        ...(span != null && span > 0 ? { durationSec: span } : {}),
      };
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (clips.length < 1) throw new Error("时间线至少需要 1 段视频");
  return { version: 1, clips };
}

export function resolveComposeRenderProfile(
  settings: SimpleFusionSettings,
  workbench?: SimpleFusionComposeWorkbenchState | null,
): RenderProfile {
  const base = parseRenderProfile(workbench?.profile ?? null);
  const bgmUrl = resolveSimpleFusionBgmUrl(settings.bgmPresetId);
  if (bgmUrl) {
    base.audio = { ...base.audio, bgmUrl, mixTts: false, bgmVolume: 0.35 };
  } else {
    base.audio = { ...base.audio, mixTts: false };
  }
  base.subtitle = { ...base.subtitle, mode: "none", burnIn: false };
  return base;
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
