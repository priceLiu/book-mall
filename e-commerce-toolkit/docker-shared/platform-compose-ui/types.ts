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
  /** 视频段 · 预览/导出是否静音内嵌原声（默认 false = 有声） */
  sourceAudioMuted?: boolean;
  /** 视频段 · 原声音量 0–1（默认 1） */
  sourceAudioVolume?: number;
  /** 配音段 · 预览/导出静音（默认 false） */
  audioPlaybackMuted?: boolean;
  /** 配音段 · 音量 0–1（默认 1） */
  audioPlaybackVolume?: number;
  /** 上游配音内容指纹（URL + 预览等）；用于 TTS 重生成后刷新波形缓存 */
  audioMediaKey?: string;
  /** 连线资产库 · 该配音对应时间线上的视频段 id（画布 upstream-audio） */
  pairedTimelineClipId?: string;
  /** 独立配音轨 · 在时间线上的起始位置（秒）；缺省则与对应视频段左缘对齐 */
  programStartSec?: number;
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
  /** 独立配音轨（TTS）· 与视频轨按连线先后各自排序 */
  orderedAudioClipIds?: string[];
  audioClips?: ComposeWorkbenchClip[];
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
