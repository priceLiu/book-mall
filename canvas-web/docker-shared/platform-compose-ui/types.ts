import type { SubtitleBurnInStyle } from "@private/media-render-subtitle-style/subtitle-style-options";

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
  source: "look" | "import" | "external";
};

export type ComposeRenderProfile = {
  transition?: { type: "xfade"; durationSec: number } | { type: "none" };
  subtitle?: {
    mode?: "script" | "asr" | "none";
    burnIn?: boolean;
    asrModelKey?: string;
    style?: SubtitleBurnInStyle;
  };
  audio?: {
    bgmUrl?: string;
    bgmVolume?: number;
    mixTts?: boolean;
    dialogueVolume?: number;
    bgmFitTimeline?: boolean;
    bgmPresetId?: string;
  };
  video?: { scaleMode?: "source" | "fit720p" | "fit1080p" };
};

export type ComposeWorkbenchState = {
  orderedClipIds: string[];
  clips: ComposeWorkbenchClip[];
  profile?: ComposeRenderProfile;
};

export type VideoFilmstripFrame = {
  atSec: number;
  thumbnailUrl: string;
};

export type ComposeTrackVariant = "ecom-mini" | "canvas-dock-mini" | "fullscreen";

export type ComposeTrackChrome = {
  variant: ComposeTrackVariant;
  zoomable?: boolean;
  showVideoImport?: boolean;
  showAudioAttach?: boolean;
};
