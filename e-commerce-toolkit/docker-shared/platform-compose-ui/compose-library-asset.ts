import type { ComposeWorkbenchClip } from "./types";

const AUDIO_EXT_RE = /\.(mp3|wav|m4a|aac|ogg|flac|opus)(\?|#|$)/i;

export function isProbablyAudioMediaUrl(url: string): boolean {
  const u = url.trim().toLowerCase();
  if (!u) return false;
  if (AUDIO_EXT_RE.test(u)) return true;
  if (u.includes("/audio/") || u.includes("audio%2F")) return true;
  return false;
}

/** 左侧资产库 · 纯音频（TTS），不可用 `<img>` 当缩略图 */
export function isAudioOnlyLibraryClip(c: ComposeWorkbenchClip): boolean {
  const audio = c.audioUrl?.trim();
  if (!audio) return false;
  if (c.posterUrl?.trim()) return false;
  const video = c.videoUrl?.trim();
  if (!video) return true;
  return isProbablyAudioMediaUrl(video);
}

export function libraryClipVisualUrl(c: ComposeWorkbenchClip): string | undefined {
  if (isAudioOnlyLibraryClip(c)) return undefined;
  return c.posterUrl?.trim() || c.videoUrl?.trim() || undefined;
}
