/** 口播分镜脚本 · 客户端可安全引用的类型与常量 */

import {
  AI_SPACE_COMPOSE_DEFAULT_OPTIONS,
  AI_SPACE_S2V_MAX_AUDIO_SEC,
  type AiSpaceComposeOverlayOptions,
} from "./ai-space-compose-types";

export { AI_SPACE_S2V_MAX_AUDIO_SEC };

export const BROADCAST_ASPECT_RATIOS = ["9:16", "16:9", "1:1"] as const;
export type BroadcastAspectRatio = (typeof BROADCAST_ASPECT_RATIOS)[number];

export const BROADCAST_PROJECT_STATUSES = [
  "draft",
  "locked",
  "rendering",
  "done",
] as const;

export const BROADCAST_SCRIPT_STATUSES = ["draft", "locked"] as const;

export const BROADCAST_SHOT_STATUSES = [
  "draft",
  "tts_ready",
  "rendering",
  "done",
  "failed",
] as const;

export type BroadcastPresenterSpec = {
  enabled: boolean;
  digitalHumanId?: string;
  appearFromSec: number;
  appearToSec?: number | null;
  overlay: AiSpaceComposeOverlayOptions;
};

export type BroadcastVisualSpec = {
  type: "video" | "placeholder";
  backgroundVideoId?: string;
  sceneDescription: string;
  loopBackground?: boolean;
};

export type BroadcastShotValidation = {
  audioTooLong?: boolean;
  missingBackground?: boolean;
  missingAudio?: boolean;
  missingDigitalHuman?: boolean;
};

export type BroadcastBrief = {
  platform?: string;
  tone?: string;
  presenterMode?: "always" | "partial" | "none";
};

export type BroadcastShotDto = {
  id: string;
  scriptId: string;
  index: number;
  startSec: number;
  endSec: number;
  durationSec: number;
  voiceoverText: string;
  sceneDescription: string;
  presenter: BroadcastPresenterSpec;
  visual: BroadcastVisualSpec;
  audioAssetId: string | null;
  backgroundVideoId: string | null;
  digitalHumanId: string | null;
  shotStatus: string;
  composeTaskId: string | null;
  outputVideoUrl: string | null;
  errorMessage: string | null;
  validation: BroadcastShotValidation;
};

export type BroadcastScriptDto = {
  id: string;
  projectId: string;
  version: number;
  status: string;
  shots: BroadcastShotDto[];
  createdAt: string;
};

export type BroadcastProjectDto = {
  id: string;
  title: string;
  sourceKind: string;
  sourceText: string | null;
  brief: BroadcastBrief;
  targetDurationSec: number | null;
  aspectRatio: string;
  status: string;
  activeScriptId: string | null;
  activeScript: BroadcastScriptDto | null;
  createdAt: string;
  updatedAt: string;
};

export type BroadcastSplitShotInput = {
  index: number;
  durationSec?: number;
  voiceoverText: string;
  sceneDescription?: string;
  presenter?: Partial<BroadcastPresenterSpec>;
  visual?: Partial<BroadcastVisualSpec>;
};

export const DEFAULT_BROADCAST_PRESENTER: BroadcastPresenterSpec = {
  enabled: false,
  appearFromSec: 0,
  appearToSec: null,
  overlay: { ...AI_SPACE_COMPOSE_DEFAULT_OPTIONS },
};

export const DEFAULT_BROADCAST_VISUAL: BroadcastVisualSpec = {
  type: "placeholder",
  sceneDescription: "",
  loopBackground: true,
};

export function normalizePresenter(raw: unknown): BroadcastPresenterSpec {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const overlayRaw =
    o.overlay && typeof o.overlay === "object"
      ? (o.overlay as Record<string, unknown>)
      : {};
  return {
    enabled: o.enabled === true,
    digitalHumanId:
      typeof o.digitalHumanId === "string" ? o.digitalHumanId : undefined,
    appearFromSec:
      typeof o.appearFromSec === "number" && o.appearFromSec >= 0
        ? o.appearFromSec
        : 0,
    appearToSec:
      typeof o.appearToSec === "number" && o.appearToSec >= 0
        ? o.appearToSec
        : o.appearToSec === null
          ? null
          : null,
    overlay: {
      scale:
        typeof overlayRaw.scale === "number"
          ? overlayRaw.scale
          : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.scale,
      position:
        overlayRaw.position === "bottom-left" ||
        overlayRaw.position === "top-right" ||
        overlayRaw.position === "top-left" ||
        overlayRaw.position === "center"
          ? overlayRaw.position
          : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.position,
      marginPx:
        typeof overlayRaw.marginPx === "number"
          ? overlayRaw.marginPx
          : AI_SPACE_COMPOSE_DEFAULT_OPTIONS.marginPx,
      burnSubtitle: overlayRaw.burnSubtitle === true,
      resolution:
        overlayRaw.resolution === "720P" ? "720P" : "480P",
      appearFromSec:
        typeof overlayRaw.appearFromSec === "number"
          ? overlayRaw.appearFromSec
          : undefined,
      appearToSec:
        typeof overlayRaw.appearToSec === "number"
          ? overlayRaw.appearToSec
          : overlayRaw.appearToSec === null
            ? null
            : undefined,
    },
  };
}

export function normalizeVisual(raw: unknown): BroadcastVisualSpec {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    type: o.type === "video" ? "video" : "placeholder",
    backgroundVideoId:
      typeof o.backgroundVideoId === "string" ? o.backgroundVideoId : undefined,
    sceneDescription:
      typeof o.sceneDescription === "string" ? o.sceneDescription : "",
    loopBackground: o.loopBackground !== false,
  };
}

export function validateBroadcastShot(args: {
  durationSec: number;
  voiceoverText: string;
  presenter: BroadcastPresenterSpec;
  visual: BroadcastVisualSpec;
  audioAssetId: string | null;
  digitalHumanId: string | null;
}): BroadcastShotValidation {
  const v: BroadcastShotValidation = {};
  if (args.durationSec >= AI_SPACE_S2V_MAX_AUDIO_SEC) v.audioTooLong = true;
  if (!args.voiceoverText.trim()) v.missingAudio = true;
  if (args.visual.type === "video" && !args.visual.backgroundVideoId) {
    v.missingBackground = true;
  }
  if (args.presenter.enabled && !args.digitalHumanId) {
    v.missingDigitalHuman = true;
  }
  return v;
}

export function formatShotTimeRange(startSec: number, endSec: number): string {
  const fmt = (s: number) => `${Math.round(s * 10) / 10}s`;
  return `${fmt(startSec)}–${fmt(endSec)}`;
}
