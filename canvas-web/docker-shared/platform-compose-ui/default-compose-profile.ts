import type { ComposeRenderProfile } from "./types";

export const DEFAULT_COMPOSE_PROFILE: ComposeRenderProfile = {
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
