import type { MediaTimelineV1, RenderProfile } from "@/lib/media/timeline-types";
import {
  DEFAULT_RENDER_PROFILE,
  parseRenderProfile,
} from "@/lib/media/timeline-types";

/** 平台简易剪辑台 · 轨道片段（与 Media Render clip 对齐，可扩展业务 id） */
export type PlatformComposeWorkbenchClip = {
  id: string;
  videoUrl: string;
  label?: string;
  posterUrl?: string;
  durationSec?: number;
  sourceStartSec?: number;
  sourceEndSec?: number;
  /** 烧录字幕 / script 模式台词（按段） */
  subtitle?: string;
  /** 段级替换音轨（TTS 等） */
  audioUrl?: string;
  lookId?: string;
  source: "look" | "import" | "external";
};

/** 工作台 profile：RenderProfile + 仅持久化用的 BGM preset id */
export type PlatformComposeWorkbenchProfile = RenderProfile & {
  audio?: RenderProfile["audio"] & {
    bgmPresetId?: string;
  };
};

export type PlatformComposeWorkbenchAudioClip = Omit<
  PlatformComposeWorkbenchClip,
  "videoUrl"
> & {
  videoUrl?: string;
  audioUrl: string;
};

export type PlatformComposeWorkbenchState = {
  orderedClipIds: string[];
  clips: PlatformComposeWorkbenchClip[];
  /** 独立配音轨顺序（与视频轨按索引对齐混音，非强制 N↔N 配对） */
  orderedAudioClipIds?: string[];
  audioClips?: PlatformComposeWorkbenchAudioClip[];
  profile?: PlatformComposeWorkbenchProfile;
};

export function emptyPlatformComposeWorkbenchState(): PlatformComposeWorkbenchState {
  return { orderedClipIds: [], clips: [] };
}

function clipMap(
  state: PlatformComposeWorkbenchState,
): Map<string, PlatformComposeWorkbenchClip> {
  return new Map(state.clips.map((c) => [c.id, c]));
}

export function parsePlatformComposeWorkbenchFromMeta(
  raw: unknown,
): PlatformComposeWorkbenchState | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const clipsRaw = m.clips;
  const orderRaw = m.orderedClipIds;
  if (!Array.isArray(clipsRaw) || !Array.isArray(orderRaw)) return null;

  const clips: PlatformComposeWorkbenchClip[] = [];
  for (const item of clipsRaw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const videoUrl = typeof c.videoUrl === "string" ? c.videoUrl.trim() : "";
    const id = typeof c.id === "string" ? c.id.trim() : "";
    if (!id || !videoUrl) continue;
    const sourceRaw = c.source;
    const source: PlatformComposeWorkbenchClip["source"] =
      sourceRaw === "import"
        ? "import"
        : sourceRaw === "external"
          ? "external"
          : "look";
    clips.push({
      id,
      videoUrl,
      label: typeof c.label === "string" ? c.label : undefined,
      posterUrl: typeof c.posterUrl === "string" ? c.posterUrl : undefined,
      durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
      sourceStartSec: typeof c.sourceStartSec === "number" ? c.sourceStartSec : undefined,
      sourceEndSec: typeof c.sourceEndSec === "number" ? c.sourceEndSec : undefined,
      subtitle: typeof c.subtitle === "string" ? c.subtitle : undefined,
      audioUrl: typeof c.audioUrl === "string" ? c.audioUrl.trim() : undefined,
      lookId: typeof c.lookId === "string" ? c.lookId : undefined,
      source,
    });
  }

  const orderedClipIds = orderRaw.filter(
    (x): x is string => typeof x === "string" && x.trim().length > 0,
  );

  let profile: PlatformComposeWorkbenchProfile | undefined;
  if (m.profile && typeof m.profile === "object") {
    profile = parsePlatformComposeWorkbenchProfile(m.profile);
  }

  const audioClipsRaw = m.audioClips;
  const audioOrderRaw = m.orderedAudioClipIds;
  const audioClips: PlatformComposeWorkbenchAudioClip[] = [];
  if (Array.isArray(audioClipsRaw)) {
    for (const item of audioClipsRaw) {
      if (!item || typeof item !== "object") continue;
      const c = item as Record<string, unknown>;
      const id = typeof c.id === "string" ? c.id.trim() : "";
      const audioUrl = typeof c.audioUrl === "string" ? c.audioUrl.trim() : "";
      if (!id || !audioUrl) continue;
      const sourceRaw = c.source;
      const source: PlatformComposeWorkbenchClip["source"] =
        sourceRaw === "import"
          ? "import"
          : sourceRaw === "external"
            ? "external"
            : "look";
      audioClips.push({
        id,
        audioUrl,
        videoUrl: typeof c.videoUrl === "string" ? c.videoUrl.trim() : undefined,
        programStartSec:
          typeof c.programStartSec === "number" && c.programStartSec >= 0
            ? c.programStartSec
            : undefined,
        pairedTimelineClipId:
          typeof c.pairedTimelineClipId === "string"
            ? c.pairedTimelineClipId.trim()
            : undefined,
        label: typeof c.label === "string" ? c.label : undefined,
        posterUrl: typeof c.posterUrl === "string" ? c.posterUrl : undefined,
        durationSec: typeof c.durationSec === "number" ? c.durationSec : undefined,
        sourceStartSec: typeof c.sourceStartSec === "number" ? c.sourceStartSec : undefined,
        sourceEndSec: typeof c.sourceEndSec === "number" ? c.sourceEndSec : undefined,
        subtitle: typeof c.subtitle === "string" ? c.subtitle : undefined,
        lookId: typeof c.lookId === "string" ? c.lookId : undefined,
        source,
      });
    }
  }
  const orderedAudioClipIds = Array.isArray(audioOrderRaw)
    ? audioOrderRaw.filter(
        (x): x is string => typeof x === "string" && x.trim().length > 0,
      )
    : undefined;

  return {
    orderedClipIds,
    clips,
    ...(orderedAudioClipIds?.length ? { orderedAudioClipIds } : {}),
    ...(audioClips.length ? { audioClips } : {}),
    profile,
  };
}

export function parsePlatformComposeWorkbenchProfile(
  raw: unknown,
): PlatformComposeWorkbenchProfile {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_RENDER_PROFILE };
  }
  const m = raw as Record<string, unknown>;
  const audioRaw = m.audio;
  let bgmPresetId: string | undefined;
  if (audioRaw && typeof audioRaw === "object") {
    const a = audioRaw as Record<string, unknown>;
    if (typeof a.bgmPresetId === "string" && a.bgmPresetId.trim()) {
      bgmPresetId = a.bgmPresetId.trim();
    }
  }
  const base = parseRenderProfile(raw);
  if (bgmPresetId) {
    return {
      ...base,
      audio: { ...base.audio, bgmPresetId },
    };
  }
  return base;
}

/** 提交 Media Render 前去掉非 RenderProfile 字段 */
export function composeWorkbenchProfileToRenderProfile(
  profile: PlatformComposeWorkbenchProfile | undefined,
  opts?: {
    resolveBgmPresetUrl?: (presetId: string) => string | undefined;
    fallbackBgmPresetId?: string;
  },
): RenderProfile {
  const parsed = profile
    ? parsePlatformComposeWorkbenchProfile(profile)
    : { ...DEFAULT_RENDER_PROFILE };

  const presetId =
    parsed.audio?.bgmPresetId?.trim() ||
    opts?.fallbackBgmPresetId?.trim() ||
    "";
  const bgmFromPreset =
    presetId && opts?.resolveBgmPresetUrl
      ? opts.resolveBgmPresetUrl(presetId)
      : undefined;
  const bgmUrl = parsed.audio?.bgmUrl?.trim() || bgmFromPreset;

  const next: RenderProfile = {
    ...parsed,
    audio: parsed.audio ? { ...parsed.audio } : undefined,
  };
  if (next.audio) {
    delete (next.audio as { bgmPresetId?: string }).bgmPresetId;
  }

  if (bgmUrl) {
    next.audio = {
      ...next.audio,
      bgmUrl,
      bgmVolume: next.audio?.bgmVolume ?? 0.35,
      mixTts: next.audio?.mixTts ?? false,
    };
  } else if (next.audio) {
    next.audio = {
      ...next.audio,
      mixTts: next.audio.mixTts ?? true,
    };
  }

  if (!next.subtitle) {
    next.subtitle = DEFAULT_RENDER_PROFILE.subtitle;
  }

  return parseRenderProfile(next);
}

function orderedWorkbenchAudioClips(
  state: PlatformComposeWorkbenchState,
): PlatformComposeWorkbenchAudioClip[] {
  const ids = state.orderedAudioClipIds ?? [];
  const map = new Map((state.audioClips ?? []).map((c) => [c.id, c]));
  return ids
    .map((id) => map.get(id))
    .filter((c): c is PlatformComposeWorkbenchAudioClip =>
      Boolean(c?.audioUrl?.trim()),
    );
}

export function platformWorkbenchToMediaTimeline(
  state: PlatformComposeWorkbenchState,
): MediaTimelineV1 {
  const map = clipMap(state);
  const audioOrdered = orderedWorkbenchAudioClips(state);
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
      const subtitle = c.subtitle?.trim();
      const perClipAudio = c.audioUrl?.trim();
      const pairedAudio = audioOrdered[order]?.audioUrl?.trim();
      const audioUrl = perClipAudio || pairedAudio;
      return {
        order,
        videoUrl: c.videoUrl.trim(),
        ...(start > 0 ? { sourceStartSec: start } : {}),
        ...(end != null && end > 0 ? { sourceEndSec: end } : {}),
        ...(span != null && span > 0 ? { durationSec: span } : {}),
        ...(subtitle ? { subtitle } : {}),
        ...(audioUrl ? { audioUrl } : {}),
      };
    })
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  if (clips.length < 1) throw new Error("时间线至少需要 1 段视频");
  return { version: 1, clips };
}

export function composeWorkbenchToRenderPayload(
  state: PlatformComposeWorkbenchState,
  opts?: {
    resolveBgmPresetUrl?: (presetId: string) => string | undefined;
    fallbackBgmPresetId?: string;
  },
): { timeline: MediaTimelineV1; profile: RenderProfile } {
  return {
    timeline: platformWorkbenchToMediaTimeline(state),
    profile: composeWorkbenchProfileToRenderProfile(state.profile, opts),
  };
}
